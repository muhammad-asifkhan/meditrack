"""
MediTrack Flask Backend — Single-file, SQLite-based, zero external dependencies beyond pip.
Run: python3 server.py
Then open: http://localhost:3001
"""
import sqlite3, os, json, hashlib, secrets, time, math, random
from datetime import datetime, timedelta
from pathlib import Path
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
import bcrypt, jwt
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
import pickle

# ─── Config ────────────────────────────────────────────────────────────────
SECRET = os.environ.get("JWT_SECRET", "meditrack-dev-secret-2024")
REFRESH_SECRET = os.environ.get("JWT_REFRESH_SECRET", "meditrack-refresh-secret-2024")
DB_PATH = Path(__file__).parent / "meditrack.db"
DIST_PATH = Path(__file__).parent / "dist"
MODEL_PATH = Path(__file__).parent / "noshow_model.pkl"

app = Flask(__name__, static_folder=None)
CORS(app, origins=["http://localhost:5173", "http://localhost:3001"], supports_credentials=True)

# ─── DB ────────────────────────────────────────────────────────────────────
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db: db.close()

def qry(sql, params=()):
    return get_db().execute(sql, params)

def qry_all(sql, params=()):
    return [dict(r) for r in get_db().execute(sql, params).fetchall()]

def qry_one(sql, params=()):
    row = get_db().execute(sql, params).fetchone()
    return dict(row) if row else None

def run(sql, params=()):
    db = get_db()
    db.execute(sql, params)
    db.commit()

# ─── Schema ────────────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS cities(id INTEGER PRIMARY KEY, name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS departments(id INTEGER PRIMARY KEY, name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS clinics(id INTEGER PRIMARY KEY, city_id INTEGER, name TEXT, address TEXT, FOREIGN KEY(city_id) REFERENCES cities(id));
CREATE TABLE IF NOT EXISTS doctors(id INTEGER PRIMARY KEY, clinic_id INTEGER, department_id INTEGER, name TEXT, seniority_level TEXT, bio TEXT, phone TEXT, email TEXT, avatar_seed TEXT, years_experience INTEGER DEFAULT 0, qualification TEXT, available_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri', consultation_start TEXT DEFAULT '09:00', consultation_end TEXT DEFAULT '17:00', rating REAL DEFAULT 4.0, languages TEXT DEFAULT 'Urdu,English', specializations TEXT, FOREIGN KEY(clinic_id) REFERENCES clinics(id), FOREIGN KEY(department_id) REFERENCES departments(id));
CREATE TABLE IF NOT EXISTS patients(id INTEGER PRIMARY KEY, name TEXT, dob TEXT, phone TEXT, email TEXT, is_returning INTEGER DEFAULT 0, gender TEXT, blood_group TEXT, address TEXT, city TEXT, allergies TEXT, chronic_conditions TEXT, avatar_seed TEXT, emergency_contact TEXT, emergency_phone TEXT);
CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY, doctor_id INTEGER, patient_id INTEGER, clinic_id INTEGER, department_id INTEGER, scheduled_at TEXT, status TEXT, consultation_fee REAL, created_at TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, role TEXT, city_id INTEGER, clinic_id INTEGER, is_active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS refresh_tokens(id INTEGER PRIMARY KEY, user_id INTEGER, token_hash TEXT UNIQUE, expires_at TEXT, revoked INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, user_id INTEGER, event_type TEXT, ip_address TEXT, user_agent TEXT, details TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS model_metrics(id INTEGER PRIMARY KEY, model_version TEXT, algorithm TEXT, accuracy REAL, precision_score REAL, recall_score REAL, f1_score REAL, auc_roc REAL, trained_at TEXT, training_rows INTEGER);
CREATE INDEX IF NOT EXISTS idx_appt_clinic ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appt_dept ON appointments(department_id);
CREATE INDEX IF NOT EXISTS idx_appt_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_scheduled ON appointments(scheduled_at);
"""

# ─── Seed ──────────────────────────────────────────────────────────────────
CITIES = ["Karachi","Lahore","Islamabad","Peshawar","Multan"]
DEPARTMENTS = ["General","Cardiology","Orthopaedics","Dermatology","Pediatrics"]
CLINICS = {
    "Karachi":[("MediTrack Clifton Centre","Block 5, Clifton"),("MediTrack DHA Clinic","Phase 6, DHA"),("MediTrack Gulshan Branch","Block 13, Gulshan"),("MediTrack Korangi Hub","Sector 31, Korangi")],
    "Lahore":[("MediTrack Gulberg Medical","Main Blvd, Gulberg"),("MediTrack DHA Lahore","Phase 1, DHA"),("MediTrack Model Town","Block D, Model Town"),("MediTrack Johar Town","Johar Town")],
    "Islamabad":[("MediTrack F-7 Centre","F-7 Markaz"),("MediTrack G-9 Clinic","G-9 Markaz"),("MediTrack Blue Area","Jinnah Avenue")],
    "Peshawar":[("MediTrack Hayatabad","Phase 5, Hayatabad"),("MediTrack University Town","Ring Road"),("MediTrack Saddar","Saddar Bazaar")],
    "Multan":[("MediTrack Cantt Medical","Cantt Area"),("MediTrack Gulgasht","Gulgasht Colony"),("MediTrack Shah Rukn-e-Alam","Shah Rukn-e-Alam Colony")],
}
FIRST_NAMES = ["Ahmed","Muhammad","Ali","Hassan","Ibrahim","Omar","Bilal","Faisal","Tariq","Asad","Imran","Zubair","Salman","Kamran","Aisha","Fatima","Zainab","Maryam","Nadia","Sana","Hira","Amna","Rabia","Sara","Ayesha"]
LAST_NAMES = ["Khan","Ahmed","Malik","Shah","Chaudhry","Mirza","Siddiqui","Qureshi","Butt","Akhtar","Hussain","Raza","Abbasi","Farooqi","Hashmi","Baig","Sheikh"]
DR_FIRST = ["Dr. Asim","Dr. Bilal","Dr. Farrukh","Dr. Hassan","Dr. Imran","Dr. Junaid","Dr. Kamran","Dr. Mohsin","Dr. Nadeem","Dr. Omar","Dr. Rashid","Dr. Saad","Dr. Tariq","Dr. Usman","Dr. Zahid","Dr. Aisha","Dr. Fatima","Dr. Hina","Dr. Lubna","Dr. Nadia","Dr. Rafia","Dr. Samia","Dr. Sana","Dr. Amna","Dr. Bushra"]
DEPT_NOSHOW = {"General":0.22,"Cardiology":0.10,"Orthopaedics":0.18,"Dermatology":0.28,"Pediatrics":0.20}
DEPT_FEES = {"General":(500,1500),"Cardiology":(2000,5000),"Orthopaedics":(1500,4000),"Dermatology":(1000,3000),"Pediatrics":(800,2000)}
SEASONAL = [1.2,1.2,1.0,0.9,0.8,0.7,0.7,0.8,0.9,1.1,1.3,1.3]
DAY_WEIGHT = [1.0,1.0,1.0,1.0,1.0,0.5,0.3]

def seed_db():
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")

    for sql in SCHEMA.strip().split(";"):
        if sql.strip(): db.execute(sql)
    db.commit()

    if db.execute("SELECT COUNT(*) FROM appointments").fetchone()[0] > 100:
        print("✅ DB already seeded")
        db.close(); return

    print("🌱 Seeding database (~2500 appointments)...")
    rng = random.Random(42)

    for c in CITIES: db.execute("INSERT OR IGNORE INTO cities(name) VALUES(?)",(c,))
    for d in DEPARTMENTS: db.execute("INSERT OR IGNORE INTO departments(name) VALUES(?)",(d,))
    db.commit()

    city_ids = {r[0]:r[1] for r in db.execute("SELECT name,id FROM cities")}
    dept_ids = {r[0]:r[1] for r in db.execute("SELECT name,id FROM departments")}

    clinic_data = []
    for city,clinics in CLINICS.items():
        for name,addr in clinics:
            db.execute("INSERT INTO clinics(city_id,name,address) VALUES(?,?,?)",(city_ids[city],name,addr))
    db.commit()
    clinic_rows = [(r[0],r[1]) for r in db.execute("SELECT id,city_id FROM clinics")]

    doctors = []
    dr_idx = 0
    QUALS_MAP = {"junior":["MBBS","MBBS, FCPS-I","MBBS, MCPS"],"senior":["MBBS, FCPS","MBBS, MRCP","MBBS, MS"],"consultant":["MBBS, FCPS, FRCP","MBBS, MD, FCPS","MBBS, FCPS (Gold Medallist)"]}
    SPECS_MAP = {"General":["Family Medicine","Internal Medicine","Preventive Care"],"Cardiology":["Interventional Cardiology","Electrophysiology","Heart Failure"],"Orthopaedics":["Joint Replacement","Spine Surgery","Sports Medicine"],"Dermatology":["Cosmetic Dermatology","Dermatosurgery","Laser & Aesthetics"],"Pediatrics":["Neonatology","Developmental Paediatrics","Paediatric Nutrition"]}
    LANGS_LIST = ["Urdu, English","Urdu, English, Punjabi","Urdu, English, Sindhi","Urdu, English, Pashto"]
    for clinic_id, city_id in clinic_rows:
        n_docs = rng.randint(4,6)
        for i in range(n_docs):
            dept_name = DEPARTMENTS[i % len(DEPARTMENTS)]
            seniority = rng.choice(["junior","senior","consultant"])
            name = f"{DR_FIRST[dr_idx % len(DR_FIRST)]} {rng.choice(LAST_NAMES)}"
            dr_idx += 1
            yrs_map = {"junior":rng.randint(1,4),"senior":rng.randint(5,12),"consultant":rng.randint(13,25)}
            yrs = yrs_map[seniority]
            bio_map = {"General":f"A compassionate family physician with over {yrs} years of experience in primary care.","Cardiology":f"A leading interventional cardiologist with {yrs} years of experience in complex coronary interventions.","Orthopaedics":f"Specialised in minimally invasive joint replacement surgery with {yrs} years of hands-on experience.","Dermatology":f"A board-certified dermatologist with {yrs} years of experience in medical and cosmetic dermatology.","Pediatrics":f"A compassionate paediatrician with {yrs} years of experience caring for newborns through adolescents."}
            qual = rng.choice(QUALS_MAP.get(seniority,["MBBS"]))
            spec = rng.choice(SPECS_MAP.get(dept_name,["General Medicine"]))
            bio = bio_map.get(dept_name,"Experienced medical professional dedicated to patient care.")
            rating = round(3.5 + rng.random()*1.5, 1)
            dr_phone = f"03{rng.randint(0,4)}{rng.randint(1000000,9999999)}"
            start_h = rng.choice(["08:00","09:00","10:00"])
            end_h = rng.choice(["16:00","17:00","18:00"])
            langs = rng.choice(LANGS_LIST)
            avail = "Mon,Tue,Wed,Thu,Fri,Sat" if rng.random()<0.3 else "Mon,Tue,Wed,Thu,Fri"
            av_seed = f"doc_{dr_idx}_{rng.randint(1000,9999)}"
            db.execute(
                "INSERT INTO doctors(clinic_id,department_id,name,seniority_level,bio,phone,qualification,specializations,years_experience,rating,available_days,consultation_start,consultation_end,languages,avatar_seed) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (clinic_id,dept_ids[dept_name],name,seniority,bio,dr_phone,qual,spec,yrs,rating,avail,start_h,end_h,langs,av_seed))
    db.commit()
    doctor_rows = [(r[0],r[1],r[2],r[3]) for r in db.execute("SELECT d.id,d.clinic_id,dept.name,d.seniority_level FROM doctors d JOIN departments dept ON dept.id=d.department_id")]

    # Get clinic->city mapping
    clinic_city = {r[0]:r[1] for r in db.execute("SELECT id,city_id FROM clinics")}

    BLOOD_GROUPS_LIST = ["A+","A-","B+","B-","O+","O-","AB+","AB-"]
    GENDERS_LIST = ["Male","Female"]
    PAT_CITIES = ["Karachi","Lahore","Islamabad","Peshawar","Multan","Rawalpindi","Faisalabad","Quetta"]
    ALLERGIES_LIST = [None,None,None,"Penicillin","Sulfa drugs","Aspirin","NSAIDs","Latex","Dust, Pollen"]
    CONDITIONS_LIST = [None,None,None,None,"Hypertension","Type 2 Diabetes","Asthma","GERD","Arthritis","Hyperlipidaemia"]
    EC_NAMES = ["Ahmed Khan","Fatima Ali","Muhammad Raza","Zainab Shah","Omar Malik","Sara Butt"]

    patients = []
    for pi in range(500):
        name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
        is_ret = 1 if rng.random() > 0.4 else 0
        yr = rng.randint(1950,2010); mo = rng.randint(1,12); dy = rng.randint(1,28)
        ph = f"03{rng.randint(0,4)}{rng.randint(1000000,9999999)}"
        p_gender = rng.choice(GENDERS_LIST)
        p_city = rng.choice(PAT_CITIES)
        p_blood = rng.choice(BLOOD_GROUPS_LIST)
        p_allergy = rng.choice(ALLERGIES_LIST)
        p_condition = rng.choice(CONDITIONS_LIST)
        p_avatar = f"pat_{pi}_{rng.randint(1000,9999)}"
        p_address = f"{rng.randint(1,999)} Street {rng.randint(1,30)}, {p_city}"
        p_ec = rng.choice(EC_NAMES) if rng.random() > 0.3 else None
        p_ec_ph = f"03{rng.randint(0,4)}{rng.randint(1000000,9999999)}" if p_ec else None
        db.execute(
            "INSERT INTO patients(name,dob,phone,email,is_returning,gender,blood_group,city,address,allergies,chronic_conditions,avatar_seed,emergency_contact,emergency_phone) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (name,f"{yr}-{mo:02d}-{dy:02d}",ph,f"{name.lower().replace(' ','.')}{rng.randint(1,99)}@gmail.com",
             is_ret,p_gender,p_blood,p_city,p_address,p_allergy,p_condition,p_avatar,p_ec,p_ec_ph))
    db.commit()
    patient_ids = [r[0] for r in db.execute("SELECT id FROM patients")]

    now = datetime.now()
    start = now - timedelta(days=730)
    appts = []
    attempts = 0
    while len(appts) < 2500 and attempts < 15000:
        attempts += 1
        doc_id, clinic_id, dept_name, seniority = rng.choice(doctor_rows)
        pat_id = rng.choice(patient_ids)
        dt = start + timedelta(seconds=rng.randint(0, int((now-start).total_seconds())))
        month = dt.month - 1
        dow = dt.weekday()
        if rng.random() > SEASONAL[month] * DAY_WEIGHT[min(dow,6)]: continue
        if dt.weekday() == 6: continue
        max_hour = 14 if dt.weekday() == 5 else 18
        hour = rng.randint(9, max_hour-1)
        dt = dt.replace(hour=hour, minute=rng.choice([0,15,30,45]), second=0, microsecond=0)
        ns_rate = DEPT_NOSHOW[dept_name]
        sen_bonus = -0.05 if seniority=="consultant" else (0.05 if seniority=="junior" else 0)
        r = rng.random()
        if r < ns_rate + sen_bonus: status = "no_show"
        elif r < ns_rate + sen_bonus + 0.12: status = "cancelled"
        else: status = "completed"
        lo, hi = DEPT_FEES[dept_name]
        fee = round(rng.randint(lo,hi) * (1.5 if seniority=="consultant" else 1.2 if seniority=="senior" else 1.0) / 100) * 100
        days_adv = rng.randint(0, 30)
        created = dt - timedelta(days=days_adv)
        city_id = clinic_city[clinic_id]
        dept_id = dept_ids[dept_name]
        appts.append((doc_id, pat_id, clinic_id, dept_id, dt.isoformat(), status, fee, created.isoformat()))

    db.executemany("INSERT INTO appointments(doctor_id,patient_id,clinic_id,department_id,scheduled_at,status,consultation_fee,created_at) VALUES(?,?,?,?,?,?,?,?)", appts)
    db.commit()
    print(f"✅ Inserted {len(appts)} appointments")

    # Users
    pw_admin = bcrypt.hashpw(b"Admin@1234", bcrypt.gensalt(12)).decode()
    pw_mgr = bcrypt.hashpw(b"Manager@1234", bcrypt.gensalt(12)).decode()
    pw_staff = bcrypt.hashpw(b"Staff@1234", bcrypt.gensalt(12)).decode()
    karachi_id = city_ids["Karachi"]; lahore_id = city_ids["Lahore"]
    first_clinic = db.execute("SELECT id FROM clinics LIMIT 1").fetchone()[0]
    now_s = now.isoformat()
    db.executemany("INSERT OR IGNORE INTO users(email,password_hash,role,city_id,clinic_id,created_at) VALUES(?,?,?,?,?,?)",[
        ("admin@meditrack.pk", pw_admin, "superadmin", None, None, now_s),
        ("karachi@meditrack.pk", pw_mgr, "city_manager", karachi_id, None, now_s),
        ("lahore@meditrack.pk", pw_mgr, "city_manager", lahore_id, None, now_s),
        ("staff@meditrack.pk", pw_staff, "clinic_staff", None, first_clinic, now_s),
    ])
    db.commit()

    # Model metrics placeholder
    db.execute("INSERT INTO model_metrics(model_version,algorithm,accuracy,precision_score,recall_score,f1_score,auc_roc,trained_at,training_rows) VALUES(?,?,?,?,?,?,?,?,?)",
               ("v1.0.0","LogisticRegression",0.782,0.734,0.689,0.711,0.821,now.isoformat(),len(appts)))
    db.commit()
    print("✅ Seeding complete!")
    print("   admin@meditrack.pk / Admin@1234")
    print("   karachi@meditrack.pk / Manager@1234")
    print("   staff@meditrack.pk / Staff@1234")
    db.close()

# ─── ML Model ──────────────────────────────────────────────────────────────
ml_model = None

def train_model():
    global ml_model
    print("🤖 Training no-show prediction model...")
    rng = np.random.RandomState(42)
    n = 3000
    hour = rng.randint(9,18,n); dow = rng.randint(0,7,n)
    dept = rng.randint(1,6,n); seniority = rng.randint(0,3,n)
    is_ret = rng.randint(0,2,n); days_adv = rng.randint(0,31,n)
    city = rng.randint(1,6,n)
    rates = {1:0.22,2:0.10,3:0.18,4:0.28,5:0.20}
    p = np.array([rates[d] for d in dept])
    p += (1-is_ret)*0.10 + (days_adv>14)*0.08 + (seniority==0)*0.05
    p += ((hour<10)|(hour>15))*0.05 + ((dow==5)|(dow==6))*0.08
    p = np.clip(p, 0, 0.9)
    y = (rng.rand(n) < p).astype(int)
    dept_oh = np.eye(5)[np.clip(dept-1,0,4)]
    city_oh = np.eye(5)[np.clip(city-1,0,4)]
    X = np.column_stack([hour/23,dow/6,dept_oh,seniority/2,is_ret,np.clip(days_adv,0,60)/60,city_oh])
    Xt,Xv,yt,yv = train_test_split(X,y,test_size=0.3,random_state=42)
    lr = LogisticRegression(max_iter=1000,random_state=42)
    lr.fit(Xt,yt); auc = roc_auc_score(yv, lr.predict_proba(Xv)[:,1])
    if auc < 0.72:
        clf = RandomForestClassifier(n_estimators=200,max_depth=8,random_state=42)
        clf.fit(Xt,yt); algo = "RandomForest"
    else:
        clf = lr; algo = "LogisticRegression"
    yp = clf.predict(Xv); yprob = clf.predict_proba(Xv)[:,1]
    metrics = dict(algorithm=algo,accuracy=round(float(accuracy_score(yv,yp)),4),
                   precision=round(float(precision_score(yv,yp,zero_division=0)),4),
                   recall=round(float(recall_score(yv,yp,zero_division=0)),4),
                   f1=round(float(f1_score(yv,yp,zero_division=0)),4),
                   auc=round(float(roc_auc_score(yv,yprob)),4))
    ml_model = clf
    with open(MODEL_PATH,"wb") as f: pickle.dump({"model":clf,"metrics":metrics},f)
    print(f"✅ Model trained: {algo}, AUC={metrics['auc']}")
    return clf, metrics

def load_model():
    global ml_model
    if MODEL_PATH.exists():
        with open(MODEL_PATH,"rb") as f:
            d = pickle.load(f); ml_model = d["model"]
        print("✅ ML model loaded from disk")
    else:
        train_model()

def predict_noshow(hour,dow,dept_id,seniority,is_ret,days_adv,city_id):
    if ml_model is None: return 0.25
    dept_oh = [0]*5; dept_oh[min(max(dept_id-1,0),4)] = 1
    city_oh = [0]*5; city_oh[min(max(city_id-1,0),4)] = 1
    X = np.array([[hour/23,dow/6,*dept_oh,seniority/2,int(is_ret),min(days_adv,60)/60,*city_oh]])
    return float(ml_model.predict_proba(X)[0][1])

# ─── Auth helpers ──────────────────────────────────────────────────────────
def make_access_token(user):
    payload = dict(userId=user["id"],email=user["email"],role=user["role"],
                   cityId=user["city_id"],clinicId=user["clinic_id"],
                   exp=datetime.utcnow()+timedelta(minutes=60))
    return jwt.encode(payload, SECRET, algorithm="HS256")

def require_auth(f):
    @wraps(f)
    def wrapper(*a,**kw):
        token = request.headers.get("Authorization","").replace("Bearer ","")
        if not token: return jsonify({"success":False,"error":"No token"}),401
        try: g.user = jwt.decode(token, SECRET, algorithms=["HS256"])
        except: return jsonify({"success":False,"error":"Invalid token"}),401
        return f(*a,**kw)
    return wrapper

def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*a,**kw):
            if g.user.get("role") not in roles:
                return jsonify({"success":False,"error":"Forbidden"}),403
            return f(*a,**kw)
        return wrapper
    return decorator

def scope_filter():
    u = g.user
    if u["role"] == "superadmin": return "", []
    if u["role"] == "city_manager" and u.get("cityId"):
        return "AND cl.city_id = ?", [u["cityId"]]
    if u["role"] == "clinic_staff" and u.get("clinicId"):
        return "AND a.clinic_id = ?", [u["clinicId"]]
    return "AND 1=0", []

def date_filter(offset=0):
    df = request.args.get("date_from"); dt = request.args.get("date_to")
    clause = ""; params = []
    if df: params.append(df); clause += f" AND a.scheduled_at >= ?"
    if dt: params.append(dt); clause += f" AND a.scheduled_at <= ?"
    return clause, params

def audit(event, details=None):
    uid = g.user.get("userId") if hasattr(g,"user") else None
    run("INSERT INTO audit_log(user_id,event_type,ip_address,user_agent,details,created_at) VALUES(?,?,?,?,?,?)",
        (uid, event, request.remote_addr, request.headers.get("User-Agent",""), json.dumps(details or {}), datetime.now().isoformat()))

# ─── Auth Routes ──────────────────────────────────────────────────────────
@app.post("/api/v1/auth/login")
def login():
    d = request.json or {}
    email = d.get("email","").strip().lower()
    pw = d.get("password","")
    user = qry_one("SELECT * FROM users WHERE email=? AND is_active=1", (email,))
    if not user or not bcrypt.checkpw(pw.encode(), user["password_hash"].encode()):
        run("INSERT INTO audit_log(event_type,ip_address,details,created_at) VALUES(?,?,?,?)",
            ("LOGIN_FAILED", request.remote_addr, json.dumps({"email":email}), datetime.now().isoformat()))
        return jsonify({"success":False,"error":"Invalid credentials"}),401
    token = make_access_token(user)
    run("INSERT INTO audit_log(user_id,event_type,ip_address,details,created_at) VALUES(?,?,?,?,?)",
        (user["id"],"LOGIN_SUCCESS",request.remote_addr,json.dumps({}),datetime.now().isoformat()))
    return jsonify({"success":True,"data":{"accessToken":token,"user":{
        "id":user["id"],"email":user["email"],"role":user["role"],
        "cityId":user["city_id"],"clinicId":user["clinic_id"]}}})

@app.post("/api/v1/auth/refresh")
def refresh():
    return jsonify({"success":False,"error":"Use login"}),401

@app.post("/api/v1/auth/logout")
def logout():
    return jsonify({"success":True,"data":None})

# ─── Analytics Routes ──────────────────────────────────────────────────────
@app.get("/api/v1/analytics/kpi-summary")
@require_auth
def kpi_summary():
    sc, sp = scope_filter(); dc, dp = date_filter()
    p = sp + dp
    row = qry_one(f"""SELECT
        COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_revenue,
        COUNT(*) AS total_appointments,
        ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/MAX(COUNT(*),1),1) AS no_show_rate,
        ROUND(100.0*SUM(CASE WHEN a.status='cancelled' THEN 1 ELSE 0 END)/MAX(COUNT(*),1),1) AS cancellation_rate,
        ROUND(AVG(CASE WHEN a.status='completed' THEN a.consultation_fee END),0) AS avg_fee
        FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id WHERE 1=1 {sc} {dc}""", p)
    td = qry_one(f"SELECT d.name FROM appointments a JOIN departments d ON d.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id WHERE a.status='completed' {sc} {dc} GROUP BY d.name ORDER BY COUNT(*) DESC LIMIT 1", p)
    tc = qry_one(f"SELECT ci.name FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id JOIN cities ci ON ci.id=cl.city_id WHERE a.status='completed' {sc} {dc} GROUP BY ci.name ORDER BY SUM(a.consultation_fee) DESC LIMIT 1", p)
    return jsonify({"success":True,"data":{**row,"top_department":(td or {}).get("name","N/A"),"top_city":(tc or {}).get("name","N/A")}})

@app.get("/api/v1/analytics/departments")
@require_auth
def dept_analytics():
    sc, sp = scope_filter(); dc, dp = date_filter(); p = sp+dp
    rows = qry_all(f"""SELECT d.id, d.name AS department, COUNT(*) AS appointment_count,
        COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,
        ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/MAX(COUNT(*),1),1) AS no_show_rate,
        ROUND(100.0*SUM(CASE WHEN a.status='cancelled' THEN 1 ELSE 0 END)/MAX(COUNT(*),1),1) AS cancellation_rate,
        ROUND(AVG(CASE WHEN a.status='completed' THEN a.consultation_fee END),0) AS avg_fee,
        ROUND(100.0*SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END)/MAX(COUNT(*),1),1) AS completion_rate
        FROM appointments a JOIN departments d ON d.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id
        WHERE 1=1 {sc} {dc} GROUP BY d.id,d.name ORDER BY revenue DESC""", p)
    return jsonify({"success":True,"data":rows})

@app.get("/api/v1/analytics/doctors")
@require_auth
def doctor_analytics():
    sc, sp = scope_filter(); dc, dp = date_filter()
    extra = ""; ep = []
    for key,col in [("city_id","cl.city_id"),("clinic_id","a.clinic_id"),("department_id","a.department_id")]:
        v = request.args.get(key)
        if v: ep.append(v); extra += f" AND {col}=?"
    sort_map = {"revenue":"revenue","no_show_rate":"no_show_rate","appointment_count":"appointment_count","completion_rate":"completion_rate"}
    sort = sort_map.get(request.args.get("sort","revenue"),"revenue")
    p = sp+dp+ep
    rows = qry_all(f"""SELECT doc.id, doc.name AS doctor, doc.seniority_level AS seniority,
        dept.name AS department, cl.name AS clinic, ci.name AS city,
        COUNT(*) AS appointment_count,
        COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,
        ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/MAX(COUNT(*),1),1) AS no_show_rate,
        ROUND(100.0*SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END)/MAX(COUNT(*),1),1) AS completion_rate,
        ROUND(AVG(CASE WHEN a.status='completed' THEN a.consultation_fee END),0) AS avg_fee
        FROM appointments a JOIN doctors doc ON doc.id=a.doctor_id JOIN departments dept ON dept.id=a.department_id
        JOIN clinics cl ON cl.id=a.clinic_id JOIN cities ci ON ci.id=cl.city_id
        WHERE 1=1 {sc} {dc} {extra} GROUP BY doc.id ORDER BY {sort} DESC""", p)
    return jsonify({"success":True,"data":rows})

@app.get("/api/v1/analytics/revenue")
@require_auth
def revenue_analytics():
    sc, sp = scope_filter(); dc, dp = date_filter(); p = sp+dp
    by_city = qry_all(f"SELECT ci.name AS city,ci.id AS city_id,COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,COUNT(*) AS appointment_count FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id JOIN cities ci ON ci.id=cl.city_id WHERE 1=1 {sc} {dc} GROUP BY ci.id ORDER BY revenue DESC",p)
    by_clinic = qry_all(f"SELECT cl.id,cl.name AS clinic,ci.name AS city,COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,COUNT(*) AS appointment_count FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id JOIN cities ci ON ci.id=cl.city_id WHERE 1=1 {sc} {dc} GROUP BY cl.id ORDER BY revenue DESC",p)
    by_dept = qry_all(f"SELECT d.name AS department,d.id,COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,COUNT(*) AS appointment_count FROM appointments a JOIN departments d ON d.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id WHERE 1=1 {sc} {dc} GROUP BY d.id ORDER BY revenue DESC",p)
    by_month = qry_all(f"SELECT strftime('%Y-%m',a.scheduled_at) AS month,d.name AS department,COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,COUNT(*) AS appointment_count FROM appointments a JOIN departments d ON d.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id WHERE 1=1 {sc} {dc} GROUP BY month,d.id ORDER BY month",p)
    return jsonify({"success":True,"data":{"by_city":by_city,"by_clinic":by_clinic,"by_department":by_dept,"by_month":by_month}})

@app.get("/api/v1/analytics/timeseries")
@require_auth
def timeseries():
    sc, sp = scope_filter(); dc, dp = date_filter(); p = sp+dp
    monthly = qry_all(f"SELECT strftime('%Y-%m',a.scheduled_at) AS month,COUNT(*) AS appointment_count,COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id WHERE 1=1 {sc} {dc} GROUP BY month ORDER BY month",p)
    weekly = qry_all(f"SELECT CAST(strftime('%w',a.scheduled_at) AS INTEGER) AS day_of_week,COUNT(*) AS appointment_count FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id WHERE 1=1 {sc} {dc} GROUP BY day_of_week ORDER BY day_of_week",p)
    hourly = qry_all(f"SELECT CAST(strftime('%w',a.scheduled_at) AS INTEGER) AS day_of_week,CAST(strftime('%H',a.scheduled_at) AS INTEGER) AS hour,COUNT(*) AS appointment_count FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id WHERE 1=1 {sc} {dc} GROUP BY day_of_week,hour ORDER BY day_of_week,hour",p)
    return jsonify({"success":True,"data":{"monthly_volume":monthly,"daily_of_week_volume":weekly,"hourly_distribution":hourly}})

# ─── Predict Route ─────────────────────────────────────────────────────────
@app.post("/api/v1/predict/no-show")
@require_auth
def predict_route():
    d = request.json or {}
    doc = qry_one("SELECT seniority_level FROM doctors WHERE id=?", (d.get("doctor_id"),))
    pat = qry_one("SELECT is_returning FROM patients WHERE id=?", (d.get("patient_id"),))
    if not doc or not pat:
        return jsonify({"success":False,"error":"Doctor or patient not found"}),404
    seniority_map = {"consultant":2,"senior":1,"junior":0}
    seniority = seniority_map.get(doc["seniority_level"],0)
    dt = datetime.fromisoformat(d.get("scheduled_at",datetime.now().isoformat()))
    days_adv = max(0,(dt-datetime.now()).days)
    prob = predict_noshow(dt.hour, dt.weekday(), int(d.get("department_id",1)), seniority, bool(pat["is_returning"]), days_adv, int(d.get("city_id",1)))
    prob = max(0.03, min(0.95, prob))
    risk = "low" if prob<0.3 else "medium" if prob<0.6 else "high"
    actions = {"low":"No action needed — low no-show risk","medium":"Send automated SMS reminder 24 hours before appointment","high":"Call patient directly — high no-show risk. Consider overbooking this slot."}
    return jsonify({"success":True,"data":{"probability":round(prob,4),"risk_level":risk,"recommended_action":actions[risk]}})

@app.get("/api/v1/predict/model-metrics")
@require_auth
def model_metrics():
    row = qry_one("SELECT * FROM model_metrics ORDER BY trained_at DESC LIMIT 1")
    return jsonify({"success":True,"data":row})

# ─── Reports ───────────────────────────────────────────────────────────────
@app.get("/api/v1/reports/export")
@require_auth
def export():
    import io, csv
    sc, sp = scope_filter(); dc, dp = date_filter(); p = sp+dp
    type_ = request.args.get("type","appointments")
    if type_ == "appointments":
        rows = qry_all(f"SELECT a.id,a.scheduled_at,a.status,a.consultation_fee,doc.name AS doctor,d.name AS department,cl.name AS clinic,ci.name AS city,pat.name AS patient FROM appointments a JOIN doctors doc ON doc.id=a.doctor_id JOIN departments d ON d.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id JOIN cities ci ON ci.id=cl.city_id JOIN patients pat ON pat.id=a.patient_id WHERE 1=1 {sc} {dc} ORDER BY a.scheduled_at DESC LIMIT 5000",p)
    elif type_ == "department":
        rows = qry_all(f"SELECT d.name AS department,COUNT(*) AS total_appointments,SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END) AS revenue FROM appointments a JOIN departments d ON d.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id WHERE 1=1 {sc} {dc} GROUP BY d.name ORDER BY revenue DESC",p)
    else:
        rows = qry_all(f"SELECT doc.name AS doctor,dept.name AS department,COUNT(*) AS appointments FROM appointments a JOIN doctors doc ON doc.id=a.doctor_id JOIN departments dept ON dept.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id WHERE 1=1 {sc} {dc} GROUP BY doc.id ORDER BY appointments DESC",p)
    audit("EXPORT",{"type":type_,"rows":len(rows)})
    if not rows: return jsonify({"success":True,"data":[]})
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
    from flask import Response
    return Response(buf.getvalue(), mimetype="text/csv", headers={"Content-Disposition":f"attachment;filename=meditrack_{type_}_export.csv"})

# ─── Admin Routes ──────────────────────────────────────────────────────────
@app.get("/api/v1/admin/users")
@require_auth
@require_role("superadmin")
def list_users():
    rows = qry_all("SELECT u.id,u.email,u.role,u.is_active,u.created_at,c.name AS city_name,cl.name AS clinic_name FROM users u LEFT JOIN cities c ON c.id=u.city_id LEFT JOIN clinics cl ON cl.id=u.clinic_id ORDER BY u.created_at DESC")
    return jsonify({"success":True,"data":rows})

@app.post("/api/v1/admin/users")
@require_auth
@require_role("superadmin")
def create_user():
    d = request.json or {}
    pw = bcrypt.hashpw(d["password"].encode(), bcrypt.gensalt(12)).decode()
    try:
        run("INSERT INTO users(email,password_hash,role,city_id,clinic_id,created_at) VALUES(?,?,?,?,?,?)",
            (d["email"].lower(), pw, d["role"], d.get("city_id"), d.get("clinic_id"), datetime.now().isoformat()))
        return jsonify({"success":True,"data":{"email":d["email"]}}),201
    except: return jsonify({"success":False,"error":"Email exists"}),409

@app.patch("/api/v1/admin/users/<int:uid>")
@require_auth
@require_role("superadmin")
def update_user(uid):
    d = request.json or {}
    if "is_active" in d:
        run("UPDATE users SET is_active=? WHERE id=?",(int(d["is_active"]),uid))
    return jsonify({"success":True,"data":None})

@app.get("/api/v1/admin/audit-log")
@require_auth
@require_role("superadmin")
def get_audit():
    page=int(request.args.get("page",1)); limit=int(request.args.get("limit",50)); offset=(page-1)*limit
    rows = qry_all("SELECT al.id,al.event_type,al.ip_address,al.created_at,al.details,u.email AS user_email,u.role AS user_role FROM audit_log al LEFT JOIN users u ON u.id=al.user_id ORDER BY al.created_at DESC LIMIT ? OFFSET ?",(limit,offset))
    total = qry_one("SELECT COUNT(*) AS c FROM audit_log")["c"]
    return jsonify({"success":True,"data":rows,"meta":{"total":total,"page":page,"limit":limit}})

@app.get("/api/v1/admin/reference")
@require_auth
def reference():
    return jsonify({"success":True,"data":{
        "cities":qry_all("SELECT id,name FROM cities ORDER BY name"),
        "clinics":qry_all("SELECT id,city_id,name FROM clinics ORDER BY name"),
        "departments":qry_all("SELECT id,name FROM departments ORDER BY name"),
        "doctors":qry_all("SELECT id,clinic_id,department_id,name,seniority_level FROM doctors ORDER BY name"),
        "patients":qry_all("SELECT id,name,phone FROM patients ORDER BY name LIMIT 300"),
    }})


# ─── Profile Routes ────────────────────────────────────────────────────────

@app.get("/api/v1/profiles/doctors")
@require_auth
def list_doctor_profiles():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 12))
    offset = (page - 1) * limit
    search = request.args.get("search", "")
    dept_id = request.args.get("department_id", "")
    city_id = request.args.get("city_id", "")
    seniority = request.args.get("seniority", "")

    params = []; filters = ""
    if search:
        params.append(f"%{search}%")
        filters += f" AND (doc.name LIKE ? OR dept.name LIKE ?)"
        params.append(f"%{search}%")
    if dept_id:
        params.append(dept_id); filters += " AND doc.department_id=?"
    if city_id:
        params.append(city_id); filters += " AND cl.city_id=?"
    if seniority:
        params.append(seniority); filters += " AND doc.seniority_level=?"

    sql = f"""SELECT doc.id, doc.name, doc.seniority_level, doc.bio, doc.phone, doc.email,
        doc.avatar_seed, doc.years_experience, doc.qualification,
        doc.available_days, doc.consultation_start, doc.consultation_end,
        doc.rating, doc.languages, doc.specializations,
        dept.name AS department, dept.id AS department_id,
        cl.name AS clinic, cl.id AS clinic_id,
        ci.name AS city, ci.id AS city_id,
        COUNT(a.id) AS total_appointments,
        COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_revenue,
        ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/MAX(COUNT(a.id),1),1) AS no_show_rate,
        ROUND(100.0*SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END)/MAX(COUNT(a.id),1),1) AS completion_rate,
        ROUND(AVG(CASE WHEN a.status='completed' THEN a.consultation_fee END),0) AS avg_fee,
        COUNT(DISTINCT a.patient_id) AS unique_patients
        FROM doctors doc
        JOIN departments dept ON dept.id=doc.department_id
        JOIN clinics cl ON cl.id=doc.clinic_id
        JOIN cities ci ON ci.id=cl.city_id
        LEFT JOIN appointments a ON a.doctor_id=doc.id
        WHERE 1=1 {filters}
        GROUP BY doc.id ORDER BY total_revenue DESC LIMIT ? OFFSET ?"""
    rows = qry_all(sql, params + [limit, offset])
    count = qry_one(f"SELECT COUNT(*) AS c FROM doctors doc JOIN departments dept ON dept.id=doc.department_id JOIN clinics cl ON cl.id=doc.clinic_id JOIN cities ci ON ci.id=cl.city_id WHERE 1=1 {filters}", params)
    return jsonify({"success": True, "data": rows, "meta": {"total": count["c"], "page": page, "limit": limit}})


@app.get("/api/v1/profiles/doctors/<int:doc_id>")
@require_auth
def get_doctor_profile(doc_id):
    profile = qry_one("""SELECT doc.id, doc.name, doc.seniority_level, doc.bio, doc.phone, doc.email,
        doc.avatar_seed, doc.years_experience, doc.qualification,
        doc.available_days, doc.consultation_start, doc.consultation_end,
        doc.rating, doc.languages, doc.specializations,
        dept.name AS department, dept.id AS department_id,
        cl.name AS clinic, cl.id AS clinic_id,
        ci.name AS city, ci.id AS city_id,
        COUNT(a.id) AS total_appointments,
        COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_revenue,
        ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/MAX(COUNT(a.id),1),1) AS no_show_rate,
        ROUND(100.0*SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END)/MAX(COUNT(a.id),1),1) AS completion_rate,
        ROUND(AVG(CASE WHEN a.status='completed' THEN a.consultation_fee END),0) AS avg_fee,
        COUNT(DISTINCT a.patient_id) AS unique_patients
        FROM doctors doc
        JOIN departments dept ON dept.id=doc.department_id
        JOIN clinics cl ON cl.id=doc.clinic_id
        JOIN cities ci ON ci.id=cl.city_id
        LEFT JOIN appointments a ON a.doctor_id=doc.id
        WHERE doc.id=? GROUP BY doc.id,dept.name,dept.id,cl.name,cl.id,ci.name,ci.id""", (doc_id,))
    if not profile: return jsonify({"success": False, "error": "Not found"}), 404

    monthly = qry_all("""SELECT strftime('%Y-%m',scheduled_at) AS month,
        COUNT(*) AS appointments,
        COALESCE(SUM(CASE WHEN status='completed' THEN consultation_fee ELSE 0 END),0) AS revenue,
        ROUND(100.0*SUM(CASE WHEN status='no_show' THEN 1 ELSE 0 END)/MAX(COUNT(*),1),1) AS no_show_rate
        FROM appointments WHERE doctor_id=? AND scheduled_at>=date('now','-12 months')
        GROUP BY month ORDER BY month""", (doc_id,))

    status_bd = qry_all("SELECT status, COUNT(*) AS count FROM appointments WHERE doctor_id=? GROUP BY status", (doc_id,))

    recent = qry_all("""SELECT a.id, a.scheduled_at, a.status, a.consultation_fee,
        p.name AS patient_name, p.phone AS patient_phone, p.is_returning
        FROM appointments a JOIN patients p ON p.id=a.patient_id
        WHERE a.doctor_id=? ORDER BY a.scheduled_at DESC LIMIT 10""", (doc_id,))

    pat_types = qry_all("""SELECT p.is_returning, COUNT(*) AS count
        FROM appointments a JOIN patients p ON p.id=a.patient_id
        WHERE a.doctor_id=? GROUP BY p.is_returning""", (doc_id,))

    top_pats = qry_all("""SELECT p.name, p.phone, p.is_returning, COUNT(*) AS visits,
        MAX(a.scheduled_at) AS last_visit
        FROM appointments a JOIN patients p ON p.id=a.patient_id
        WHERE a.doctor_id=? GROUP BY p.id ORDER BY visits DESC LIMIT 5""", (doc_id,))

    return jsonify({"success": True, "data": {
        "profile": profile, "monthly_trend": monthly, "status_breakdown": status_bd,
        "recent_appointments": recent, "patient_types": pat_types, "top_patients": top_pats
    }})


@app.get("/api/v1/profiles/patients")
@require_auth
def list_patient_profiles():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 15))
    offset = (page - 1) * limit
    search = request.args.get("search", "")
    is_ret = request.args.get("is_returning", "")

    params = []; filters = ""
    if search:
        params.append(f"%{search}%"); params.append(f"%{search}%"); params.append(f"%{search}%")
        filters += " AND (p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)"
    if is_ret:
        params.append(1 if is_ret == "true" else 0)
        filters += " AND p.is_returning=?"

    rows = qry_all(f"""SELECT p.id, p.name, p.dob, p.phone, p.email, p.is_returning,
        p.gender, p.blood_group, p.address, p.city, p.allergies, p.chronic_conditions,
        p.avatar_seed, p.emergency_contact, p.emergency_phone,
        COUNT(a.id) AS total_visits, MAX(a.scheduled_at) AS last_visit,
        MIN(a.scheduled_at) AS first_visit,
        COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_spent,
        ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/MAX(COUNT(a.id),1),1) AS no_show_rate,
        ROUND(100.0*SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END)/MAX(COUNT(a.id),1),1) AS completion_rate
        FROM patients p LEFT JOIN appointments a ON a.patient_id=p.id
        WHERE 1=1 {filters} GROUP BY p.id ORDER BY total_visits DESC, p.name LIMIT ? OFFSET ?""",
        params + [limit, offset])
    count = qry_one(f"SELECT COUNT(*) AS c FROM patients p WHERE 1=1 {filters}", params)
    return jsonify({"success": True, "data": rows, "meta": {"total": count["c"], "page": page, "limit": limit}})


@app.get("/api/v1/profiles/patients/<int:pat_id>")
@require_auth
def get_patient_profile(pat_id):
    profile = qry_one("""SELECT p.id, p.name, p.dob, p.phone, p.email, p.is_returning,
        p.gender, p.blood_group, p.address, p.city, p.allergies, p.chronic_conditions,
        p.avatar_seed, p.emergency_contact, p.emergency_phone,
        COUNT(a.id) AS total_visits, MAX(a.scheduled_at) AS last_visit,
        MIN(a.scheduled_at) AS first_visit,
        COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_spent,
        ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/MAX(COUNT(a.id),1),1) AS no_show_rate,
        ROUND(100.0*SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END)/MAX(COUNT(a.id),1),1) AS completion_rate
        FROM patients p LEFT JOIN appointments a ON a.patient_id=p.id
        WHERE p.id=? GROUP BY p.id""", (pat_id,))
    if not profile: return jsonify({"success": False, "error": "Not found"}), 404

    history = qry_all("""SELECT a.id, a.scheduled_at, a.status, a.consultation_fee,
        doc.name AS doctor_name, doc.seniority_level,
        dept.name AS department, cl.name AS clinic, ci.name AS city
        FROM appointments a
        JOIN doctors doc ON doc.id=a.doctor_id
        JOIN departments dept ON dept.id=a.department_id
        JOIN clinics cl ON cl.id=a.clinic_id JOIN cities ci ON ci.id=cl.city_id
        WHERE a.patient_id=? ORDER BY a.scheduled_at DESC LIMIT 20""", (pat_id,))

    dept_bd = qry_all("""SELECT dept.name AS department, COUNT(*) AS visits,
        SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END) AS spent
        FROM appointments a JOIN departments dept ON dept.id=a.department_id
        WHERE a.patient_id=? GROUP BY dept.name ORDER BY visits DESC""", (pat_id,))

    docs_seen = qry_all("""SELECT doc.name, doc.seniority_level, dept.name AS department,
        COUNT(*) AS visits, MAX(a.scheduled_at) AS last_seen
        FROM appointments a JOIN doctors doc ON doc.id=a.doctor_id
        JOIN departments dept ON dept.id=a.department_id
        WHERE a.patient_id=? GROUP BY doc.id ORDER BY visits DESC LIMIT 5""", (pat_id,))

    monthly = qry_all("""SELECT strftime('%Y-%m',scheduled_at) AS month,
        COUNT(*) AS visits,
        SUM(CASE WHEN status='completed' THEN consultation_fee ELSE 0 END) AS spent
        FROM appointments WHERE patient_id=? AND scheduled_at>=date('now','-12 months')
        GROUP BY month ORDER BY month""", (pat_id,))

    return jsonify({"success": True, "data": {
        "profile": profile, "visit_history": history,
        "department_breakdown": dept_bd, "doctors_seen": docs_seen, "monthly_visits": monthly
    }})

# ─── Serve React frontend ──────────────────────────────────────────────────
@app.get("/", defaults={"path":""})
@app.get("/<path:path>")
def serve_frontend(path):
    if path and (DIST_PATH / path).exists():
        return send_from_directory(str(DIST_PATH), path)
    return send_from_directory(str(DIST_PATH), "index.html")

# ─── Health ────────────────────────────────────────────────────────────────
@app.get("/health")
def health(): return jsonify({"status":"ok","time":datetime.now().isoformat()})

# ─── Main ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🏥 MediTrack Analytics Server")
    print("=" * 40)
    seed_db()
    load_model()
    print("\n🚀 Server starting on http://localhost:3001")
    print("   Open your browser at: http://localhost:3001")
    print("   Login: admin@meditrack.pk / Admin@1234\n")
    app.run(host="0.0.0.0", port=3001, debug=False, threaded=True)
