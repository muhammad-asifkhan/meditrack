import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../db/pool';

const router = Router();
router.use(authenticate);

// ─── DOCTOR PROFILES ─────────────────────────────────────────────────────

/**
 * GET /api/v1/profiles/doctors
 * List all doctors with rich profile data + aggregate stats
 */
router.get('/doctors', async (req: Request, res: Response): Promise<void> => {
  const { search, department_id, city_id, clinic_id, seniority, page = '1', limit = '20' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const params: unknown[] = [];
  let filters = '';
  if (search) { params.push(`%${search}%`); filters += ` AND (doc.name ILIKE $${params.length} OR dept.name ILIKE $${params.length})`; }
  if (department_id) { params.push(department_id); filters += ` AND doc.department_id = $${params.length}`; }
  if (city_id) { params.push(city_id); filters += ` AND cl.city_id = $${params.length}`; }
  if (clinic_id) { params.push(clinic_id); filters += ` AND doc.clinic_id = $${params.length}`; }
  if (seniority) { params.push(seniority); filters += ` AND doc.seniority_level = $${params.length}`; }

  try {
    const [doctors, countRes] = await Promise.all([
      query(`
        SELECT
          doc.id, doc.name, doc.seniority_level, doc.bio, doc.phone, doc.email,
          doc.avatar_seed, doc.years_experience, doc.qualification,
          doc.available_days, doc.consultation_start, doc.consultation_end,
          doc.rating, doc.languages, doc.specializations,
          dept.name AS department, dept.id AS department_id,
          cl.name AS clinic, cl.id AS clinic_id,
          ci.name AS city, ci.id AS city_id,
          COUNT(a.id) AS total_appointments,
          COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_revenue,
          ROUND(100.0 * SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id),0), 1) AS no_show_rate,
          ROUND(100.0 * SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id),0), 1) AS completion_rate,
          ROUND(AVG(CASE WHEN a.status='completed' THEN a.consultation_fee END), 0) AS avg_fee,
          COUNT(DISTINCT a.patient_id) AS unique_patients
        FROM doctors doc
        JOIN departments dept ON dept.id = doc.department_id
        JOIN clinics cl ON cl.id = doc.clinic_id
        JOIN cities ci ON ci.id = cl.city_id
        LEFT JOIN appointments a ON a.doctor_id = doc.id
        WHERE 1=1 ${filters}
        GROUP BY doc.id, dept.name, dept.id, cl.name, cl.id, ci.name, ci.id
        ORDER BY total_revenue DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, parseInt(limit), offset]),
      query(`SELECT COUNT(*) FROM doctors doc JOIN departments dept ON dept.id=doc.department_id JOIN clinics cl ON cl.id=doc.clinic_id JOIN cities ci ON ci.id=cl.city_id WHERE 1=1 ${filters}`, params),
    ]);

    res.json({
      success: true,
      data: doctors.rows,
      meta: { total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch doctors' });
  }
});

/**
 * GET /api/v1/profiles/doctors/:id
 * Full doctor profile with monthly trends, patient breakdown, recent appointments
 */
router.get('/doctors/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const [profile, monthly, statusBreakdown, recentAppts, patientTypes, topPatients] = await Promise.all([
      // Core profile
      query(`
        SELECT doc.id, doc.name, doc.seniority_level, doc.bio, doc.phone, doc.email,
               doc.avatar_seed, doc.years_experience, doc.qualification,
               doc.available_days, doc.consultation_start, doc.consultation_end,
               doc.rating, doc.languages, doc.specializations,
               dept.name AS department, dept.id AS department_id,
               cl.name AS clinic, cl.id AS clinic_id,
               ci.name AS city, ci.id AS city_id,
               COUNT(a.id) AS total_appointments,
               COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_revenue,
               ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/NULLIF(COUNT(a.id),0),1) AS no_show_rate,
               ROUND(100.0*SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END)/NULLIF(COUNT(a.id),0),1) AS completion_rate,
               ROUND(AVG(CASE WHEN a.status='completed' THEN a.consultation_fee END),0) AS avg_fee,
               COUNT(DISTINCT a.patient_id) AS unique_patients
        FROM doctors doc
        JOIN departments dept ON dept.id=doc.department_id
        JOIN clinics cl ON cl.id=doc.clinic_id
        JOIN cities ci ON ci.id=cl.city_id
        LEFT JOIN appointments a ON a.doctor_id=doc.id
        WHERE doc.id=$1 GROUP BY doc.id,dept.name,dept.id,cl.name,cl.id,ci.name,ci.id
      `, [id]),
      // Monthly trend (last 12 months)
      query(`
        SELECT TO_CHAR(DATE_TRUNC('month',scheduled_at),'YYYY-MM') AS month,
               COUNT(*) AS appointments,
               COALESCE(SUM(CASE WHEN status='completed' THEN consultation_fee ELSE 0 END),0) AS revenue,
               ROUND(100.0*SUM(CASE WHEN status='no_show' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),1) AS no_show_rate
        FROM appointments WHERE doctor_id=$1 AND scheduled_at >= NOW()-INTERVAL '12 months'
        GROUP BY month ORDER BY month
      `, [id]),
      // Status breakdown
      query(`SELECT status, COUNT(*) AS count FROM appointments WHERE doctor_id=$1 GROUP BY status`, [id]),
      // Recent 10 appointments
      query(`
        SELECT a.id, a.scheduled_at, a.status, a.consultation_fee,
               p.name AS patient_name, p.phone AS patient_phone, p.is_returning
        FROM appointments a JOIN patients p ON p.id=a.patient_id
        WHERE a.doctor_id=$1 ORDER BY a.scheduled_at DESC LIMIT 10
      `, [id]),
      // New vs returning patients
      query(`
        SELECT p.is_returning, COUNT(*) AS count
        FROM appointments a JOIN patients p ON p.id=a.patient_id
        WHERE a.doctor_id=$1 GROUP BY p.is_returning
      `, [id]),
      // Top 5 patients by visits
      query(`
        SELECT p.name, p.phone, p.is_returning, COUNT(*) AS visits,
               MAX(a.scheduled_at) AS last_visit
        FROM appointments a JOIN patients p ON p.id=a.patient_id
        WHERE a.doctor_id=$1 GROUP BY p.id,p.name,p.phone,p.is_returning
        ORDER BY visits DESC LIMIT 5
      `, [id]),
    ]);

    if (!profile.rows[0]) {
      res.status(404).json({ success: false, error: 'Doctor not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        profile: profile.rows[0],
        monthly_trend: monthly.rows,
        status_breakdown: statusBreakdown.rows,
        recent_appointments: recentAppts.rows,
        patient_types: patientTypes.rows,
        top_patients: topPatients.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch doctor profile' });
  }
});

// ─── PATIENT PROFILES ─────────────────────────────────────────────────────

/**
 * GET /api/v1/profiles/patients
 * List patients with search, filters, stats
 */
router.get('/patients', async (req: Request, res: Response): Promise<void> => {
  const { search, is_returning, page = '1', limit = '20' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params: unknown[] = [];
  let filters = '';
  if (search) {
    params.push(`%${search}%`);
    filters += ` AND (p.name ILIKE $${params.length} OR p.phone ILIKE $${params.length} OR p.email ILIKE $${params.length})`;
  }
  if (is_returning !== undefined) {
    params.push(is_returning === 'true');
    filters += ` AND p.is_returning = $${params.length}`;
  }

  try {
    const [patients, countRes] = await Promise.all([
      query(`
        SELECT p.id, p.name, p.dob, p.phone, p.email, p.is_returning,
               p.gender, p.blood_group, p.address, p.city, p.allergies,
               p.chronic_conditions, p.avatar_seed,
               p.emergency_contact, p.emergency_phone,
               COUNT(a.id) AS total_visits,
               MAX(a.scheduled_at) AS last_visit,
               MIN(a.scheduled_at) AS first_visit,
               COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_spent,
               ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/NULLIF(COUNT(a.id),0),1) AS no_show_rate
        FROM patients p
        LEFT JOIN appointments a ON a.patient_id = p.id
        WHERE 1=1 ${filters}
        GROUP BY p.id
        ORDER BY total_visits DESC, p.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, parseInt(limit), offset]),
      query(`SELECT COUNT(*) FROM patients p WHERE 1=1 ${filters}`, params),
    ]);

    res.json({
      success: true,
      data: patients.rows,
      meta: { total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch patients' });
  }
});

/**
 * GET /api/v1/profiles/patients/:id
 * Full patient profile with visit history, departments visited, doctors seen
 */
router.get('/patients/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const [profile, visits, deptBreakdown, doctorsSeen, monthlyVisits] = await Promise.all([
      query(`
        SELECT p.id, p.name, p.dob, p.phone, p.email, p.is_returning,
               p.gender, p.blood_group, p.address, p.city, p.allergies,
               p.chronic_conditions, p.avatar_seed,
               p.emergency_contact, p.emergency_phone,
               COUNT(a.id) AS total_visits,
               MAX(a.scheduled_at) AS last_visit,
               MIN(a.scheduled_at) AS first_visit,
               COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS total_spent,
               ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/NULLIF(COUNT(a.id),0),1) AS no_show_rate,
               ROUND(100.0*SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END)/NULLIF(COUNT(a.id),0),1) AS completion_rate
        FROM patients p LEFT JOIN appointments a ON a.patient_id=p.id
        WHERE p.id=$1 GROUP BY p.id
      `, [id]),
      // Full appointment history
      query(`
        SELECT a.id, a.scheduled_at, a.status, a.consultation_fee,
               doc.name AS doctor_name, doc.seniority_level,
               dept.name AS department,
               cl.name AS clinic, ci.name AS city
        FROM appointments a
        JOIN doctors doc ON doc.id=a.doctor_id
        JOIN departments dept ON dept.id=a.department_id
        JOIN clinics cl ON cl.id=a.clinic_id
        JOIN cities ci ON ci.id=cl.city_id
        WHERE a.patient_id=$1 ORDER BY a.scheduled_at DESC LIMIT 20
      `, [id]),
      // Departments visited
      query(`
        SELECT dept.name AS department, COUNT(*) AS visits,
               SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END) AS spent
        FROM appointments a JOIN departments dept ON dept.id=a.department_id
        WHERE a.patient_id=$1 GROUP BY dept.name ORDER BY visits DESC
      `, [id]),
      // Doctors seen
      query(`
        SELECT doc.name, doc.seniority_level, dept.name AS department,
               COUNT(*) AS visits, MAX(a.scheduled_at) AS last_seen
        FROM appointments a JOIN doctors doc ON doc.id=a.doctor_id
        JOIN departments dept ON dept.id=a.department_id
        WHERE a.patient_id=$1 GROUP BY doc.id,doc.name,doc.seniority_level,dept.name
        ORDER BY visits DESC LIMIT 5
      `, [id]),
      // Monthly visits (last 12 months)
      query(`
        SELECT TO_CHAR(DATE_TRUNC('month',scheduled_at),'YYYY-MM') AS month,
               COUNT(*) AS visits,
               SUM(CASE WHEN status='completed' THEN consultation_fee ELSE 0 END) AS spent
        FROM appointments WHERE patient_id=$1 AND scheduled_at>=NOW()-INTERVAL '12 months'
        GROUP BY month ORDER BY month
      `, [id]),
    ]);

    if (!profile.rows[0]) {
      res.status(404).json({ success: false, error: 'Patient not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        profile: profile.rows[0],
        visit_history: visits.rows,
        department_breakdown: deptBreakdown.rows,
        doctors_seen: doctorsSeen.rows,
        monthly_visits: monthlyVisits.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch patient profile' });
  }
});

export default router;
