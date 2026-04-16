/**
 * MediTrack Inline Seeder
 * Runs inside the main Node process — works in both dev (ts-node) and prod (compiled JS)
 */
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Peshawar', 'Multan'];
const DEPARTMENTS = ['General', 'Cardiology', 'Orthopaedics', 'Dermatology', 'Pediatrics'];

const CLINICS: Record<string, [string, string][]> = {
  Karachi: [
    ['MediTrack Clifton Centre', 'Block 5, Clifton, Karachi'],
    ['MediTrack DHA Clinic', 'Phase 6, DHA, Karachi'],
    ['MediTrack Gulshan Branch', 'Block 13, Gulshan-e-Iqbal, Karachi'],
    ['MediTrack Korangi Hub', 'Sector 31, Korangi, Karachi'],
  ],
  Lahore: [
    ['MediTrack Gulberg Medical', 'Main Boulevard, Gulberg III, Lahore'],
    ['MediTrack DHA Lahore', 'Phase 1, DHA, Lahore'],
    ['MediTrack Model Town', 'Block D, Model Town, Lahore'],
    ['MediTrack Johar Town', 'Johar Town, Lahore'],
  ],
  Islamabad: [
    ['MediTrack F-7 Centre', 'F-7 Markaz, Islamabad'],
    ['MediTrack G-9 Clinic', 'G-9 Markaz, Islamabad'],
    ['MediTrack Blue Area', 'Jinnah Avenue, Blue Area, Islamabad'],
  ],
  Peshawar: [
    ['MediTrack Hayatabad', 'Phase 5, Hayatabad, Peshawar'],
    ['MediTrack University Town', 'Ring Road, University Town, Peshawar'],
    ['MediTrack Saddar', 'Saddar Bazaar, Peshawar'],
  ],
  Multan: [
    ['MediTrack Cantt Medical', 'Cantt Area, Multan'],
    ['MediTrack Gulgasht', 'Gulgasht Colony, Multan'],
    ['MediTrack Shah Rukn-e-Alam', 'Shah Rukn-e-Alam Colony, Multan'],
  ],
};

const FIRST_NAMES = ['Ahmed','Muhammad','Ali','Hassan','Ibrahim','Omar','Bilal','Faisal','Tariq','Asad','Imran','Zubair','Salman','Kamran','Aisha','Fatima','Zainab','Maryam','Nadia','Sana','Hira','Amna','Rabia','Sara','Ayesha'];
const LAST_NAMES = ['Khan','Ahmed','Malik','Shah','Chaudhry','Mirza','Siddiqui','Qureshi','Butt','Akhtar','Hussain','Raza','Abbasi','Farooqi','Hashmi','Baig','Sheikh'];
const DR_FIRST = ['Dr. Asim','Dr. Bilal','Dr. Farrukh','Dr. Hassan','Dr. Imran','Dr. Junaid','Dr. Kamran','Dr. Mohsin','Dr. Nadeem','Dr. Omar','Dr. Rashid','Dr. Saad','Dr. Tariq','Dr. Usman','Dr. Zahid','Dr. Aisha','Dr. Fatima','Dr. Hina','Dr. Lubna','Dr. Nadia','Dr. Rafia','Dr. Samia','Dr. Sana','Dr. Amna','Dr. Bushra'];

const DEPT_NOSHOW: Record<string, number> = { General: 0.22, Cardiology: 0.10, Orthopaedics: 0.18, Dermatology: 0.28, Pediatrics: 0.20 };
const DEPT_FEES: Record<string, [number, number]> = { General: [500, 1500], Cardiology: [2000, 5000], Orthopaedices: [1500, 4000], Orthopaedics: [1500, 4000], Dermatology: [1000, 3000], Pediatrics: [800, 2000] };
const SEASONAL = [1.2,1.2,1.0,0.9,0.8,0.7,0.7,0.8,0.9,1.1,1.3,1.3];
const DAY_WEIGHT = [1.0,1.0,1.0,1.0,1.0,0.5,0.3];

const QUALS: Record<string, string[]> = {
  junior: ['MBBS','MBBS, FCPS-I','MBBS, MCPS'],
  senior: ['MBBS, FCPS','MBBS, MRCP','MBBS, MS'],
  consultant: ['MBBS, FCPS, FRCP','MBBS, MD, FCPS','MBBS, FCPS (Gold Medallist)'],
};
const SPECS: Record<string, string[]> = {
  General: ['Family Medicine','Internal Medicine','Preventive Care'],
  Cardiology: ['Interventional Cardiology','Electrophysiology','Heart Failure'],
  Orthopaedics: ['Joint Replacement','Spine Surgery','Sports Medicine'],
  Dermatology: ['Cosmetic Dermatology','Dermatosurgery','Laser & Aesthetics'],
  Pediatrics: ['Neonatology','Developmental Paediatrics','Paediatric Nutrition'],
};
const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
const GENDERS = ['Male','Female'];
const PAT_CITIES = ['Karachi','Lahore','Islamabad','Peshawar','Multan','Rawalpindi','Faisalabad'];
const ALLERGIES = [null,null,null,'Penicillin','Sulfa drugs','Aspirin','NSAIDs','Latex'];
const CONDITIONS = [null,null,null,null,'Hypertension','Type 2 Diabetes','Asthma','GERD','Arthritis'];
const EC_NAMES = ['Ahmed Khan','Fatima Ali','Muhammad Raza','Zainab Shah','Omar Malik','Sara Butt'];
const LANGS = ['Urdu, English','Urdu, English, Punjabi','Urdu, English, Sindhi','Urdu, English, Pashto'];

let rngState = 42;
function rng(): number { rngState = (rngState * 1664525 + 1013904223) & 0xffffffff; return (rngState >>> 0) / 4294967296; }
function randInt(min: number, max: number): number { return Math.floor(rng() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }
function randPhone(): string { return `03${randInt(0,4)}${randInt(1000000,9999999)}`; }

export async function seedDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding MediTrack database...');

    // Insert base data
    for (const c of CITIES) await client.query('INSERT INTO cities(name) VALUES($1) ON CONFLICT DO NOTHING', [c]);
    for (const d of DEPARTMENTS) await client.query('INSERT INTO departments(name) VALUES($1) ON CONFLICT DO NOTHING', [d]);

    const cityMap: Record<string, number> = {};
    for (const r of (await client.query('SELECT id,name FROM cities')).rows) cityMap[r.name] = r.id;
    const deptMap: Record<string, number> = {};
    for (const r of (await client.query('SELECT id,name FROM departments')).rows) deptMap[r.name] = r.id;

    // Clinics
    const clinicCityMap: Record<number, number> = {};
    for (const [cityName, clinics] of Object.entries(CLINICS)) {
      for (const [name, addr] of clinics) {
        const r = await client.query('INSERT INTO clinics(city_id,name,address) VALUES($1,$2,$3) RETURNING id', [cityMap[cityName], name, addr]);
        clinicCityMap[r.rows[0].id] = cityMap[cityName];
      }
    }

    const clinicIds = Object.keys(clinicCityMap).map(Number);
    let drIdx = 0;
    type DocRow = { id: number; clinicId: number; deptName: string; seniority: string };
    const doctors: DocRow[] = [];

    for (const clinicId of clinicIds) {
      for (let i = 0; i < randInt(4, 6); i++) {
        const deptName = DEPARTMENTS[i % DEPARTMENTS.length];
        const seniority = pick(['junior', 'senior', 'consultant'] as const);
        const name = `${DR_FIRST[drIdx % DR_FIRST.length]} ${pick(LAST_NAMES)}`;
        drIdx++;
        const yrsMap = { junior: randInt(1,4), senior: randInt(5,12), consultant: randInt(13,25) };
        const yrs = yrsMap[seniority];
        const bioMap: Record<string, string> = {
          General: `A compassionate family physician with over ${yrs} years of experience in primary care.`,
          Cardiology: `A leading interventional cardiologist with ${yrs} years of experience in complex coronary interventions.`,
          Orthopaedics: `Specialised in minimally invasive joint replacement surgery with ${yrs} years of experience.`,
          Dermatology: `A board-certified dermatologist with ${yrs} years of experience in medical and cosmetic dermatology.`,
          Pediatrics: `A compassionate paediatrician with ${yrs} years of experience caring for children of all ages.`,
        };
        const r = await client.query(
          `INSERT INTO doctors(clinic_id,department_id,name,seniority_level,bio,phone,qualification,specializations,
           years_experience,rating,available_days,consultation_start,consultation_end,languages,avatar_seed)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
          [clinicId, deptMap[deptName], name, seniority, bioMap[deptName] || '',
           randPhone(), pick(QUALS[seniority]), pick(SPECS[deptName] || ['General Medicine']),
           yrs, parseFloat((3.5 + rng() * 1.5).toFixed(1)),
           rng() > 0.3 ? 'Mon,Tue,Wed,Thu,Fri' : 'Mon,Tue,Wed,Thu,Fri,Sat',
           pick(['08:00','09:00','10:00']), pick(['16:00','17:00','18:00']),
           pick(LANGS), `doc_${drIdx}_${randInt(1000,9999)}`]
        );
        doctors.push({ id: r.rows[0].id, clinicId, deptName, seniority });
      }
    }
    console.log(`✅ Inserted ${doctors.length} doctors`);

    // Patients
    const patientIds: number[] = [];
    for (let i = 0; i < 500; i++) {
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const isRet = rng() > 0.4;
      const yr = randInt(1950, 2010); const mo = randInt(1,12); const dy = randInt(1,28);
      const pCity = pick(PAT_CITIES);
      const r = await client.query(
        `INSERT INTO patients(name,dob,phone,email,is_returning,gender,blood_group,city,address,
         allergies,chronic_conditions,avatar_seed,emergency_contact,emergency_phone)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [name, `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`,
         randPhone(), `${name.toLowerCase().replace(/ /g,'.')}${randInt(1,99)}@gmail.com`,
         isRet, pick(GENDERS), pick(BLOOD_GROUPS), pCity,
         `${randInt(1,999)} Street ${randInt(1,30)}, ${pCity}`,
         pick(ALLERGIES), pick(CONDITIONS), `pat_${i}_${randInt(1000,9999)}`,
         rng() > 0.3 ? pick(EC_NAMES) : null,
         rng() > 0.3 ? randPhone() : null]
      );
      patientIds.push(r.rows[0].id);
    }
    console.log(`✅ Inserted ${patientIds.length} patients`);

    // Appointments
    const now = new Date();
    const start = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
    let count = 0;

    for (let attempt = 0; attempt < 15000 && count < 2500; attempt++) {
      const doc = pick(doctors);
      const patId = pick(patientIds);
      const dt = new Date(start.getTime() + rng() * (now.getTime() - start.getTime()));
      const month = dt.getMonth();
      const dow = dt.getDay();
      if (rng() > SEASONAL[month] * DAY_WEIGHT[dow === 0 ? 6 : dow - 1]) continue;
      if (dow === 0) continue;
      const maxHour = dow === 6 ? 14 : 18;
      const hour = randInt(9, maxHour - 1);
      dt.setHours(hour, pick([0, 15, 30, 45]), 0, 0);

      const nsRate = DEPT_NOSHOW[doc.deptName] || 0.20;
      const senBonus = doc.seniority === 'consultant' ? -0.05 : doc.seniority === 'junior' ? 0.05 : 0;
      const r = rng();
      const status = r < nsRate + senBonus ? 'no_show' : r < nsRate + senBonus + 0.12 ? 'cancelled' : 'completed';

      const fees = DEPT_FEES[doc.deptName] || [500, 1500];
      const fee = Math.round(randInt(fees[0], fees[1]) * (doc.seniority === 'consultant' ? 1.5 : doc.seniority === 'senior' ? 1.2 : 1.0) / 100) * 100;
      const daysAdv = randInt(0, 30);
      const created = new Date(dt.getTime() - daysAdv * 86400000);

      await client.query(
        'INSERT INTO appointments(doctor_id,patient_id,clinic_id,department_id,scheduled_at,status,consultation_fee,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [doc.id, patId, doc.clinicId, deptMap[doc.deptName], dt.toISOString(), status, fee, created.toISOString()]
      );
      count++;
    }
    console.log(`✅ Inserted ${count} appointments`);

    // Users
    const pwAdmin = await bcrypt.hash('Admin@1234', 12);
    const pwMgr = await bcrypt.hash('Manager@1234', 12);
    const pwStaff = await bcrypt.hash('Staff@1234', 12);
    const firstClinic = clinicIds[0];
    await client.query(`
      INSERT INTO users(email,password_hash,role,city_id,clinic_id,created_at) VALUES
      ('admin@meditrack.pk',$1,'superadmin',NULL,NULL,NOW()),
      ('karachi@meditrack.pk',$2,'city_manager',$3,NULL,NOW()),
      ('lahore@meditrack.pk',$2,'city_manager',$4,NULL,NOW()),
      ('staff@meditrack.pk',$5,'clinic_staff',NULL,$6,NOW())
      ON CONFLICT(email) DO NOTHING`,
      [pwAdmin, pwMgr, cityMap['Karachi'], cityMap['Lahore'], pwStaff, firstClinic]
    );

    // Model metrics placeholder
    await client.query(
      `INSERT INTO model_metrics(model_version,algorithm,accuracy,precision_score,recall_score,f1_score,auc_roc,trained_at,training_rows)
       VALUES('v1.0.0','LogisticRegression',0.782,0.734,0.689,0.711,0.821,NOW(),$1)`,
      [count]
    );

    console.log('🎉 Seed complete!');
    console.log('   admin@meditrack.pk / Admin@1234');
    console.log('   karachi@meditrack.pk / Manager@1234');
    console.log('   staff@meditrack.pk / Staff@1234');

  } finally {
    client.release();
  }
}
