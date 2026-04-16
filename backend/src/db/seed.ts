/**
 * MediTrack Database Seeder
 * Generates realistic synthetic data: 5 cities × 3-4 clinics × 4-6 doctors × ~2000 appointments
 * with seasonality, weekend dips, department-level no-show variance
 */
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'meditrack',
  user: process.env.DB_USER || 'meditrack_user',
  password: process.env.DB_PASSWORD || 'meditrack_secret_2024',
});

const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Peshawar', 'Multan'];
const DEPARTMENTS = ['General', 'Cardiology', 'Orthopaedics', 'Dermatology', 'Pediatrics'];

const CLINICS_DATA: Record<string, { name: string; address: string }[]> = {
  Karachi: [
    { name: 'MediTrack Clifton Centre', address: 'Block 5, Clifton, Karachi' },
    { name: 'MediTrack DHA Clinic', address: 'Phase 6, DHA, Karachi' },
    { name: 'MediTrack Gulshan Branch', address: 'Block 13, Gulshan-e-Iqbal, Karachi' },
    { name: 'MediTrack Korangi Health Hub', address: 'Sector 31, Korangi, Karachi' },
  ],
  Lahore: [
    { name: 'MediTrack Gulberg Medical', address: 'Main Boulevard, Gulberg III, Lahore' },
    { name: 'MediTrack DHA Lahore', address: 'Phase 1, DHA, Lahore' },
    { name: 'MediTrack Model Town', address: 'Block D, Model Town, Lahore' },
    { name: 'MediTrack Johar Town', address: 'Sector A, Johar Town, Lahore' },
  ],
  Islamabad: [
    { name: 'MediTrack F-7 Centre', address: 'F-7 Markaz, Islamabad' },
    { name: 'MediTrack G-9 Clinic', address: 'G-9 Markaz, Islamabad' },
    { name: 'MediTrack Blue Area', address: 'Jinnah Avenue, Blue Area, Islamabad' },
  ],
  Peshawar: [
    { name: 'MediTrack Hayatabad', address: 'Phase 5, Hayatabad, Peshawar' },
    { name: 'MediTrack University Town', address: 'Ring Road, University Town, Peshawar' },
    { name: 'MediTrack Saddar Clinic', address: 'Saddar Bazaar, Peshawar' },
  ],
  Multan: [
    { name: 'MediTrack Cantt Medical', address: 'Cantt Area, Multan' },
    { name: 'MediTrack Gulgasht Branch', address: 'Gulgasht Colony, Multan' },
    { name: 'MediTrack Shah Rukn-e-Alam', address: 'Shah Rukn-e-Alam Colony, Multan' },
  ],
};

const FIRST_NAMES = ['Ahmed', 'Muhammad', 'Ali', 'Hassan', 'Ibrahim', 'Omar', 'Usman', 'Bilal',
  'Faisal', 'Tariq', 'Asad', 'Imran', 'Zubair', 'Salman', 'Kamran', 'Aisha', 'Fatima', 'Zainab',
  'Maryam', 'Nadia', 'Sana', 'Hira', 'Amna', 'Rabia', 'Sara', 'Ayesha', 'Rukhsana', 'Bushra'];

const LAST_NAMES = ['Khan', 'Ahmed', 'Malik', 'Shah', 'Chaudhry', 'Mirza', 'Siddiqui', 'Qureshi',
  'Butt', 'Akhtar', 'Hussain', 'Raza', 'Abbasi', 'Farooqi', 'Hashmi', 'Baig', 'Ansari', 'Sheikh'];

const DOCTOR_FIRST_NAMES = ['Dr. Asim', 'Dr. Bilal', 'Dr. Farrukh', 'Dr. Hassan', 'Dr. Imran',
  'Dr. Junaid', 'Dr. Kamran', 'Dr. Mohsin', 'Dr. Nadeem', 'Dr. Omar', 'Dr. Rashid', 'Dr. Saad',
  'Dr. Tariq', 'Dr. Usman', 'Dr. Zahid', 'Dr. Aisha', 'Dr. Fatima', 'Dr. Hina', 'Dr. Lubna',
  'Dr. Nadia', 'Dr. Rafia', 'Dr. Samia', 'Dr. Sana', 'Dr. Zubaida', 'Dr. Amna', 'Dr. Bushra'];

const SENORITY_LEVELS: ('junior' | 'senior' | 'consultant')[] = ['junior', 'senior', 'consultant'];

// Department-specific no-show rates (realistic variance)
const DEPT_NOSHSOW_RATES: Record<string, number> = {
  General: 0.22,
  Cardiology: 0.10,
  Orthopaedics: 0.18,
  Dermatology: 0.28,
  Pediatrics: 0.20,
};

// Department-specific fees (PKR)
const DEPT_FEES: Record<string, { min: number; max: number }> = {
  General: { min: 500, max: 1500 },
  Cardiology: { min: 2000, max: 5000 },
  Orthopaedics: { min: 1500, max: 4000 },
  Dermatology: { min: 1000, max: 3000 },
  Pediatrics: { min: 800, max: 2000 },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function randName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function randPhone(): string {
  return `03${randInt(0, 4)}${randInt(1000000, 9999999)}`;
}

function randEmail(name: string): string {
  return `${name.toLowerCase().replace(/\s/g, '.')}${randInt(1, 999)}@gmail.com`;
}

// Seasonal weight: higher in winter (Oct-Feb), lower in summer (May-Jul)
function getSeasonalWeight(month: number): number {
  const weights = [1.2, 1.2, 1.0, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.1, 1.3, 1.3];
  return weights[month];
}

// Weekend dip (Fri = 0.5, Sat = 0.3)
function getDayWeight(dayOfWeek: number): number {
  const weights = [1.0, 1.0, 1.0, 1.0, 1.0, 0.5, 0.3]; // Mon-Sun
  return weights[dayOfWeek];
}

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting MediTrack seed...');

    // Check if already seeded
    const check = await client.query('SELECT COUNT(*) FROM appointments');
    if (parseInt(check.rows[0].count) > 100) {
      console.log('✅ Database already seeded, skipping...');
      return;
    }

    // Get city IDs
    const citiesRes = await client.query('SELECT id, name FROM cities ORDER BY id');
    const deptRes = await client.query('SELECT id, name FROM departments ORDER BY id');

    const cityMap: Record<string, number> = {};
    for (const row of citiesRes.rows) cityMap[row.name] = row.id;

    const deptMap: Record<string, number> = {};
    for (const row of deptRes.rows) deptMap[row.name] = row.id;

    // Insert clinics
    const clinicIds: number[] = [];
    const clinicCityMap: Record<number, number> = {};
    for (const [cityName, clinics] of Object.entries(CLINICS_DATA)) {
      for (const clinic of clinics) {
        const res = await client.query(
          'INSERT INTO clinics (city_id, name, address) VALUES ($1, $2, $3) RETURNING id',
          [cityMap[cityName], clinic.name, clinic.address]
        );
        const cid = res.rows[0].id;
        clinicIds.push(cid);
        clinicCityMap[cid] = cityMap[cityName];
      }
    }
    console.log(`✅ Inserted ${clinicIds.length} clinics`);

    // Insert doctors (4-6 per clinic, across departments)
    const doctorIds: number[] = [];
    type DoctorInfo = { id: number; clinicId: number; deptId: number; deptName: string; seniority: string };
    const doctors: DoctorInfo[] = [];
    let nameIdx = 0;

    for (const clinicId of clinicIds) {
      const numDoctors = randInt(4, 6);
      for (let i = 0; i < numDoctors; i++) {
        const deptName = DEPARTMENTS[i % DEPARTMENTS.length];
        const seniority = pick(SENORITY_LEVELS);
        const dname = DOCTOR_FIRST_NAMES[nameIdx % DOCTOR_FIRST_NAMES.length] + ' ' + pick(LAST_NAMES);
        nameIdx++;
        const quals: Record<string, string[]> = {
          junior: ['MBBS', 'MBBS, FCPS-I', 'MBBS, MCPS'],
          senior: ['MBBS, FCPS', 'MBBS, MRCP', 'MBBS, MS'],
          consultant: ['MBBS, FCPS, FRCP', 'MBBS, FCPS (Gold Medallist)', 'MBBS, MD, FCPS'],
        };
        const specMap: Record<string, string[]> = {
          General: ['Family Medicine', 'Internal Medicine', 'Preventive Care'],
          Cardiology: ['Interventional Cardiology', 'Electrophysiology', 'Heart Failure'],
          Orthopaedics: ['Joint Replacement', 'Spine Surgery', 'Sports Medicine'],
          Dermatology: ['Cosmetic Dermatology', 'Dermatosurgery', 'Laser & Aesthetics'],
          Pediatrics: ['Neonatology', 'Developmental Paediatrics', 'Paediatric Nutrition'],
        };
        const yearsMap = { junior: randInt(1,4), senior: randInt(5,12), consultant: randInt(13,25) };
        const yearsExp = yearsMap[seniority as keyof typeof yearsMap];
        const bioMap: Record<string, string> = {
          General: `A compassionate family physician with over ${yearsExp} years of experience in primary care.`,
          Cardiology: `A leading interventional cardiologist with ${yearsExp} years of experience in complex coronary interventions.`,
          Orthopaedics: `Specialised in minimally invasive joint replacement surgery with ${yearsExp} years of hands-on experience.`,
          Dermatology: `A board-certified dermatologist with ${yearsExp} years of experience in medical and cosmetic dermatology.`,
          Pediatrics: `A compassionate paediatrician with ${yearsExp} years of experience caring for newborns through adolescents.`,
        };
        const qual = pick(quals[seniority] || ['MBBS']);
        const spec = pick(specMap[deptName] || ['General Medicine']);
        const bio = bioMap[deptName] || 'Experienced medical professional dedicated to patient care.';
        const rating = parseFloat((3.5 + Math.random() * 1.5).toFixed(1));
        const drPhone = `03${randInt(0,4)}${randInt(1000000,9999999)}`;
        const startHour = pick(['08:00','09:00','10:00']);
        const endHour = pick(['16:00','17:00','18:00']);
        const langs = pick(['Urdu, English','Urdu, English, Punjabi','Urdu, English, Sindhi','Urdu, English, Pashto']);
        const availDays = Math.random() > 0.3 ? 'Mon,Tue,Wed,Thu,Fri' : 'Mon,Tue,Wed,Thu,Fri,Sat';
        const avatarSeed = `doc_${nameIdx}_${Math.random().toString(36).slice(2,8)}`;
        const res = await client.query(
          `INSERT INTO doctors (clinic_id, department_id, name, seniority_level, bio, phone, qualification,
           specializations, years_experience, rating, available_days, consultation_start, consultation_end,
           languages, avatar_seed)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
          [clinicId, deptMap[deptName], dname, seniority, bio, drPhone, qual,
           spec, yearsExp, rating, availDays, startHour, endHour, langs, avatarSeed]
        );
        const did = res.rows[0].id;
        doctorIds.push(did);
        doctors.push({ id: did, clinicId, deptId: deptMap[deptName], deptName, seniority });
      }
    }
    console.log(`✅ Inserted ${doctorIds.length} doctors`);

    // Insert patients (500 unique patients)
    const patientIds: number[] = [];
    const numPatients = 500;
    for (let i = 0; i < numPatients; i++) {
      const name = randName();
      const isReturning = Math.random() > 0.4;
      const dob = new Date(randInt(1950, 2010), randInt(0, 11), randInt(1, 28));
      const patGender = pick(['Male','Female']);
      const patCity = pick(['Karachi','Lahore','Islamabad','Peshawar','Multan','Rawalpindi']);
      const patBlood = pick(['A+','A-','B+','B-','O+','O-','AB+','AB-']);
      const patAllergy = pick([null,null,null,'Penicillin','Sulfa drugs','Aspirin','NSAIDs','Latex']);
      const patCondition = pick([null,null,null,null,'Hypertension','Type 2 Diabetes','Asthma','GERD','Arthritis']);
      const patAvatar = `pat_${i}_${Math.random().toString(36).slice(2,8)}`;
      const patAddress = `${randInt(1,999)} Street ${randInt(1,30)}, ${patCity}`;
      const res = await client.query(
        `INSERT INTO patients (name, dob, phone, email, is_returning, gender, blood_group,
         city, address, allergies, chronic_conditions, avatar_seed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [name, dob.toISOString().split('T')[0], randPhone(), randEmail(name), isReturning,
         patGender, patBlood, patCity, patAddress, patAllergy, patCondition, patAvatar]
      );
      patientIds.push(res.rows[0].id);
    }
    console.log(`✅ Inserted ${patientIds.length} patients`);

    // Insert appointments spanning 24 months with realistic patterns
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 24);

    let totalAppointments = 0;
    const appointmentBatch: unknown[][] = [];

    // Target ~2500 appointments
    const targetAppts = 2500;
    let attempts = 0;

    while (totalAppointments < targetAppts && attempts < 10000) {
      attempts++;
      const doctor = pick(doctors);
      const patientId = pick(patientIds);

      // Random date in 24-month window
      const apptDate = new Date(start.getTime() + Math.random() * (now.getTime() - start.getTime()));
      const month = apptDate.getMonth();
      const dow = apptDate.getDay(); // 0=Sun..6=Sat

      // Seasonal and day-of-week filtering
      const seasonalWeight = getSeasonalWeight(month);
      const dayWeight = getDayWeight(dow === 0 ? 6 : dow - 1); // convert JS dow to Mon=0
      if (Math.random() > seasonalWeight * dayWeight) continue;

      // Working hours: 9am-6pm on weekdays, 9am-2pm on Sat, skip Sun
      if (dow === 0) continue; // Skip Sunday
      const maxHour = dow === 6 ? 14 : 18;
      const hour = randInt(9, maxHour - 1);
      apptDate.setHours(hour, pick([0, 15, 30, 45]), 0, 0);

      // Status calculation
      const noShowRate = DEPT_NOSHSOW_RATES[doctor.deptName] || 0.20;
      const cancelRate = 0.12;
      const seniority_bonus = doctor.seniority === 'consultant' ? -0.05 : doctor.seniority === 'junior' ? 0.05 : 0;
      const rand = Math.random();
      let status: 'completed' | 'cancelled' | 'no_show';
      if (rand < noShowRate + seniority_bonus) status = 'no_show';
      else if (rand < noShowRate + seniority_bonus + cancelRate) status = 'cancelled';
      else status = 'completed';

      // Consultation fee
      const deptFees = DEPT_FEES[doctor.deptName];
      const feeBase = randInt(deptFees.min, deptFees.max);
      const seniorityMultiplier = doctor.seniority === 'consultant' ? 1.5 : doctor.seniority === 'senior' ? 1.2 : 1.0;
      const fee = Math.round(feeBase * seniorityMultiplier / 100) * 100;

      // Days booked in advance (for ML feature)
      const daysInAdvance = randInt(0, 30);
      const createdAt = new Date(apptDate.getTime() - daysInAdvance * 24 * 60 * 60 * 1000);

      // Get clinic city
      const cityId = clinicCityMap[doctor.clinicId];

      appointmentBatch.push([
        doctor.id, patientId, doctor.clinicId, doctor.deptId,
        apptDate.toISOString(), status, fee, createdAt.toISOString(), cityId
      ]);
      totalAppointments++;
    }

    // Bulk insert appointments
    console.log(`📊 Inserting ${totalAppointments} appointments...`);
    for (let i = 0; i < appointmentBatch.length; i += 100) {
      const batch = appointmentBatch.slice(i, i + 100);
      for (const appt of batch) {
        await client.query(
          `INSERT INTO appointments (doctor_id, patient_id, clinic_id, department_id, scheduled_at, status, consultation_fee, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          appt.slice(0, 8)
        );
      }
      if (i % 500 === 0) console.log(`  ... ${Math.min(i + 100, totalAppointments)}/${totalAppointments}`);
    }
    console.log(`✅ Inserted ${totalAppointments} appointments`);

    // Insert default users
    const passwordHash = await bcrypt.hash('Admin@1234', 12);
    const cityManagerHash = await bcrypt.hash('Manager@1234', 12);
    const staffHash = await bcrypt.hash('Staff@1234', 12);

    await client.query(
      `INSERT INTO users (email, password_hash, role, city_id, clinic_id) VALUES
       ('admin@meditrack.pk', $1, 'superadmin', NULL, NULL),
       ('karachi@meditrack.pk', $2, 'city_manager', $3, NULL),
       ('lahore@meditrack.pk', $2, 'city_manager', $4, NULL),
       ('staff@meditrack.pk', $5, 'clinic_staff', NULL, $6)
       ON CONFLICT (email) DO NOTHING`,
      [passwordHash, cityManagerHash, cityMap['Karachi'], cityMap['Lahore'], staffHash, clinicIds[0]]
    );
    console.log('✅ Inserted default users');

    // Insert sample model metrics
    await client.query(
      `INSERT INTO model_metrics (model_version, algorithm, accuracy, precision_score, recall_score, f1_score, auc_roc, training_rows)
       VALUES ('v1.0.0', 'LogisticRegression', 0.7820, 0.7340, 0.6890, 0.7107, 0.8210, $1)`,
      [totalAppointments]
    );
    console.log('✅ Inserted model metrics');

    console.log('\n🎉 Seeding complete!');
    console.log('📋 Login credentials:');
    console.log('  Super Admin: admin@meditrack.pk / Admin@1234');
    console.log('  City Manager (Karachi): karachi@meditrack.pk / Manager@1234');
    console.log('  Clinic Staff: staff@meditrack.pk / Staff@1234');

  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);

