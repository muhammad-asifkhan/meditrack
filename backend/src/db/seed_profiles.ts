/**
 * Profile enrichment seeder
 * Adds avatar seeds, bios, qualifications, medical history to existing records
 */
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'meditrack',
  user: process.env.DB_USER || 'meditrack_user',
  password: process.env.DB_PASSWORD || 'meditrack_secret_2024',
});

const QUALIFICATIONS: Record<string, string[]> = {
  junior: ['MBBS', 'MBBS, FCPS-I', 'MBBS, MCPS'],
  senior: ['MBBS, FCPS', 'MBBS, MRCP', 'MBBS, MS', 'MBBS, FCPS, MRCP'],
  consultant: ['MBBS, FCPS, FRCP', 'MBBS, FCPS (Gold Medallist)', 'MBBS, MD, FCPS', 'MBBS, FRCS, FCPS'],
};

const SPECIALIZATIONS: Record<string, string[]> = {
  General: ['Family Medicine', 'Internal Medicine', 'Preventive Care', 'Chronic Disease Management'],
  Cardiology: ['Interventional Cardiology', 'Electrophysiology', 'Heart Failure', 'Echocardiography', 'Cardiac Imaging'],
  Orthopaedics: ['Joint Replacement', 'Spine Surgery', 'Sports Medicine', 'Trauma Surgery', 'Paediatric Orthopaedics'],
  Dermatology: ['Cosmetic Dermatology', 'Medical Dermatology', 'Dermatosurgery', 'Laser & Aesthetics', 'Paediatric Dermatology'],
  Pediatrics: ['Neonatology', 'Paediatric Cardiology', 'Developmental Paediatrics', 'Paediatric Nutrition'],
};

const BIOS: Record<string, string[]> = {
  General: [
    'A compassionate family physician with over {years} years of experience in primary care, committed to delivering evidence-based medicine with a patient-centred approach across Karachi.',
    'Dedicated to preventive medicine and holistic patient care, with expertise in managing complex multi-system conditions across diverse patient populations.',
  ],
  Cardiology: [
    'A leading interventional cardiologist with {years} years of experience in complex coronary interventions, cardiac catheterisation, and advanced heart failure management.',
    'Expert in non-invasive cardiac imaging and electrophysiology, with extensive training in the UK and extensive clinical experience at top cardiac centres in Pakistan.',
  ],
  Orthopaedics: [
    'Specialised in minimally invasive joint replacement surgery with {years} years of hands-on experience helping patients regain mobility and quality of life.',
    'A sports medicine specialist and trauma surgeon with expertise in arthroscopic procedures and complex fracture management.',
  ],
  Dermatology: [
    'A board-certified dermatologist with {years} years of experience in both medical and cosmetic dermatology, dedicated to achieving outstanding skin health outcomes.',
    'Expert in laser-based skin therapies, dermatosurgery, and the management of complex chronic skin conditions including psoriasis, eczema, and autoimmune dermatoses.',
  ],
  Pediatrics: [
    'A compassionate paediatrician with {years} years of experience caring for newborns through adolescents, with special interest in developmental disorders and childhood nutrition.',
    'Dedicated to the comprehensive care of children from birth to 18 years, with expertise in neonatology and paediatric emergency medicine.',
  ],
};

const LANGUAGES = ['Urdu, English', 'Urdu, English, Punjabi', 'Urdu, English, Sindhi', 'Urdu, English, Pashto'];
const GENDERS = ['Male', 'Female'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Peshawar', 'Multan', 'Quetta', 'Faisalabad', 'Rawalpindi'];
const ALLERGIES = [
  null, null, null,
  'Penicillin', 'Sulfa drugs', 'Aspirin', 'NSAIDs',
  'Penicillin, Aspirin', 'Latex', 'Dust, Pollen',
];
const CONDITIONS = [
  null, null, null, null,
  'Hypertension', 'Type 2 Diabetes', 'Asthma',
  'Hypertension, Type 2 Diabetes', 'Thyroid disorder',
  'GERD', 'Hyperlipidaemia', 'Arthritis',
];
const AREAS: Record<string, string[]> = {
  Karachi: ['Clifton', 'DHA', 'Gulshan', 'North Nazimabad', 'Malir', 'Korangi', 'Saddar', 'Lyari'],
  Lahore: ['Gulberg', 'DHA', 'Model Town', 'Johar Town', 'Iqbal Town', 'Wapda Town'],
  Islamabad: ['F-7', 'G-9', 'F-10', 'E-11', 'I-8', 'G-11'],
  Peshawar: ['Hayatabad', 'University Town', 'Saddar', 'Gulbahar', 'Kohat Road'],
  Multan: ['Cantt', 'Gulgasht', 'New Multan', 'Shah Rukn-e-Alam', 'Bosan Road'],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedProfiles(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🎨 Seeding profile data...');

    // Check if already done
    const check = await client.query(`SELECT COUNT(*) FROM doctors WHERE avatar_seed IS NOT NULL`);
    if (parseInt(check.rows[0].count) > 10) {
      console.log('✅ Profile data already seeded');
      return;
    }

    // Enrich doctors
    const doctors = await client.query(`
      SELECT doc.id, doc.seniority_level, dept.name AS dept_name
      FROM doctors doc JOIN departments dept ON dept.id = doc.department_id
    `);

    for (const doc of doctors.rows) {
      const yearsMap = { junior: randInt(1, 4), senior: randInt(5, 12), consultant: randInt(13, 25) };
      const years = yearsMap[doc.seniority_level as keyof typeof yearsMap];
      const quals = QUALIFICATIONS[doc.seniority_level] || ['MBBS'];
      const qualification = pick(quals);
      const specs = SPECIALIZATIONS[doc.dept_name] || ['General Medicine'];
      const specializations = pick(specs) + (Math.random() > 0.5 ? ', ' + pick(specs) : '');
      const bioTemplate = pick(BIOS[doc.dept_name] || BIOS['General']);
      const bio = bioTemplate.replace('{years}', String(years));
      const rating = parseFloat((3.5 + Math.random() * 1.5).toFixed(1));
      const availDays = Math.random() > 0.3 ? 'Mon,Tue,Wed,Thu,Fri' : 'Mon,Tue,Wed,Thu,Fri,Sat';
      const startHour = pick(['08:00', '09:00', '10:00']);
      const endHour = pick(['16:00', '17:00', '18:00']);
      const phone = `03${randInt(0, 4)}${randInt(1000000, 9999999)}`;
      const avatarSeed = `doc_${doc.id}_${Math.random().toString(36).slice(2, 8)}`;

      await client.query(`
        UPDATE doctors SET
          bio=$1, qualification=$2, specializations=$3, years_experience=$4,
          rating=$5, available_days=$6, consultation_start=$7, consultation_end=$8,
          phone=$9, languages=$10, avatar_seed=$11
        WHERE id=$12
      `, [bio, qualification, specializations, years, rating, availDays, startHour, endHour,
          phone, pick(LANGUAGES), avatarSeed, doc.id]);
    }
    console.log(`✅ Enriched ${doctors.rows.length} doctor profiles`);

    // Enrich patients
    const patients = await client.query(`SELECT id FROM patients`);
    for (const pat of patients.rows) {
      const gender = pick(GENDERS);
      const city = pick(CITIES);
      const area = (AREAS[city] || ['City Centre'])[randInt(0, (AREAS[city] || ['City Centre']).length - 1)];
      const avatarSeed = `pat_${pat.id}_${Math.random().toString(36).slice(2, 8)}`;

      await client.query(`
        UPDATE patients SET
          gender=$1, blood_group=$2, address=$3, city=$4,
          allergies=$5, chronic_conditions=$6, avatar_seed=$7
        WHERE id=$8
      `, [gender, pick(BLOOD_GROUPS), `${randInt(1, 999)} Street ${randInt(1, 20)}, ${area}, ${city}`,
          city, pick(ALLERGIES), pick(CONDITIONS), avatarSeed, pat.id]);
    }
    console.log(`✅ Enriched ${patients.rows.length} patient profiles`);

    // Add emergency contacts for 70% of patients
    const patientsWithEmergency = await client.query(`SELECT id FROM patients ORDER BY RANDOM() LIMIT $1`, [Math.floor(patients.rows.length * 0.7)]);
    const NAMES = ['Ahmed Khan', 'Fatima Ali', 'Muhammad Raza', 'Zainab Shah', 'Omar Malik', 'Sara Butt', 'Hassan Siddiqui'];
    for (const pat of patientsWithEmergency.rows) {
      await client.query(`UPDATE patients SET emergency_contact=$1, emergency_phone=$2 WHERE id=$3`, [
        pick(NAMES), `03${randInt(0, 4)}${randInt(1000000, 9999999)}`, pat.id,
      ]);
    }
    console.log('✅ Added emergency contacts');

  } finally {
    client.release();
    await pool.end();
  }
}

seedProfiles().catch(console.error);
