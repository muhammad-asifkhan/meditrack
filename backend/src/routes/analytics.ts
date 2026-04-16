import { Router, Request, Response } from 'express';
import { authenticate, getScopeFilter } from '../middleware/auth';
import { query } from '../db/pool';

const router = Router();
router.use(authenticate);

function buildDateFilter(dateFrom?: string, dateTo?: string, offset: number = 0): { clause: string; params: string[] } {
  const params: string[] = [];
  let clause = '';
  if (dateFrom) {
    params.push(dateFrom);
    clause += ` AND a.scheduled_at >= $${offset + params.length}`;
  }
  if (dateTo) {
    params.push(dateTo);
    clause += ` AND a.scheduled_at <= $${offset + params.length}`;
  }
  return { clause, params };
}

/**
 * GET /api/v1/analytics/kpi-summary
 * Returns total revenue, appointments, no-show rate, cancellation rate
 */
router.get('/kpi-summary', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const scope = getScopeFilter(user);
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = buildDateFilter(dateFrom, dateTo, scope.params.length);
  const allParams = [...scope.params, ...dateFilter.params];

  try {
    const sql = `
      SELECT
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.consultation_fee ELSE 0 END), 0) AS total_revenue,
        COUNT(*) AS total_appointments,
        ROUND(100.0 * SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS no_show_rate,
        ROUND(100.0 * SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS cancellation_rate,
        ROUND(AVG(CASE WHEN a.status = 'completed' THEN a.consultation_fee END), 0) AS avg_fee
      FROM appointments a
      JOIN clinics cl ON cl.id = a.clinic_id
      WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
    `;
    const kpiRes = await query(sql, allParams);

    // Top department
    const topDeptSql = `
      SELECT d.name, COUNT(*) as cnt
      FROM appointments a
      JOIN departments d ON d.id = a.department_id
      JOIN clinics cl ON cl.id = a.clinic_id
      WHERE a.status = 'completed' ${scope.clinicClause} ${dateFilter.clause}
      GROUP BY d.name ORDER BY cnt DESC LIMIT 1
    `;
    const topDept = await query(topDeptSql, allParams);

    // Top city
    const topCitySql = `
      SELECT ci.name, SUM(a.consultation_fee) as rev
      FROM appointments a
      JOIN clinics cl ON cl.id = a.clinic_id
      JOIN cities ci ON ci.id = cl.city_id
      WHERE a.status = 'completed' ${scope.clinicClause} ${dateFilter.clause}
      GROUP BY ci.name ORDER BY rev DESC LIMIT 1
    `;
    const topCity = await query(topCitySql, allParams);

    res.json({
      success: true,
      data: {
        ...kpiRes.rows[0],
        top_department: topDept.rows[0]?.name || 'N/A',
        top_city: topCity.rows[0]?.name || 'N/A',
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch KPI summary' });
  }
});

/**
 * GET /api/v1/analytics/departments
 */
router.get('/departments', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const scope = getScopeFilter(user);
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = buildDateFilter(dateFrom, dateTo, scope.params.length);
  const allParams = [...scope.params, ...dateFilter.params];

  try {
    const sql = `
      SELECT
        d.id,
        d.name AS department,
        COUNT(*) AS appointment_count,
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.consultation_fee ELSE 0 END), 0) AS revenue,
        ROUND(100.0 * SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS no_show_rate,
        ROUND(100.0 * SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS cancellation_rate,
        ROUND(AVG(CASE WHEN a.status = 'completed' THEN a.consultation_fee END), 0) AS avg_fee,
        ROUND(100.0 * SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS completion_rate
      FROM appointments a
      JOIN departments d ON d.id = a.department_id
      JOIN clinics cl ON cl.id = a.clinic_id
      WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
      GROUP BY d.id, d.name
      ORDER BY revenue DESC
    `;
    const result = await query(sql, allParams);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch department analytics' });
  }
});

/**
 * GET /api/v1/analytics/doctors
 */
router.get('/doctors', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const scope = getScopeFilter(user);
  const { dateFrom, dateTo, city_id, clinic_id, department_id, sort = 'revenue', order = 'DESC' } = req.query as Record<string, string>;
  const dateFilter = buildDateFilter(dateFrom, dateTo, scope.params.length);

  const extraParams = [...scope.params, ...dateFilter.params];
  let extraFilter = '';
  if (city_id) { extraFilter += ` AND cl.city_id = $${extraParams.length + 1}`; extraParams.push(city_id); }
  if (clinic_id) { extraFilter += ` AND a.clinic_id = $${extraParams.length + 1}`; extraParams.push(clinic_id); }
  if (department_id) { extraFilter += ` AND a.department_id = $${extraParams.length + 1}`; extraParams.push(department_id); }

  const validSorts: Record<string, string> = {
    revenue: 'revenue', no_show_rate: 'no_show_rate', appointment_count: 'appointment_count', completion_rate: 'completion_rate'
  };
  const safeSort = validSorts[sort] || 'revenue';
  const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

  try {
    const sql = `
      SELECT
        doc.id,
        doc.name AS doctor,
        doc.seniority_level AS seniority,
        dept.name AS department,
        cl.name AS clinic,
        ci.name AS city,
        COUNT(*) AS appointment_count,
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.consultation_fee ELSE 0 END), 0) AS revenue,
        ROUND(100.0 * SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS no_show_rate,
        ROUND(100.0 * SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS completion_rate,
        ROUND(AVG(CASE WHEN a.status = 'completed' THEN a.consultation_fee END), 0) AS avg_fee
      FROM appointments a
      JOIN doctors doc ON doc.id = a.doctor_id
      JOIN departments dept ON dept.id = a.department_id
      JOIN clinics cl ON cl.id = a.clinic_id
      JOIN cities ci ON ci.id = cl.city_id
      WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause} ${extraFilter}
      GROUP BY doc.id, doc.name, doc.seniority_level, dept.name, cl.name, ci.name
      ORDER BY ${safeSort} ${safeOrder}
    `;
    const result = await query(sql, extraParams);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch doctor analytics' });
  }
});

/**
 * GET /api/v1/analytics/revenue
 * Returns revenue by city, clinic, department, and month
 */
router.get('/revenue', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const scope = getScopeFilter(user);
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = buildDateFilter(dateFrom, dateTo, scope.params.length);
  const allParams = [...scope.params, ...dateFilter.params];

  try {
    const [byCity, byClinic, byDept, byMonth] = await Promise.all([
      query(`
        SELECT ci.name AS city, ci.id AS city_id,
               COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,
               COUNT(*) AS appointment_count
        FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id JOIN cities ci ON ci.id=cl.city_id
        WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
        GROUP BY ci.id, ci.name ORDER BY revenue DESC
      `, allParams),
      query(`
        SELECT cl.id, cl.name AS clinic, ci.name AS city,
               COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,
               COUNT(*) AS appointment_count
        FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id JOIN cities ci ON ci.id=cl.city_id
        WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
        GROUP BY cl.id, cl.name, ci.name ORDER BY revenue DESC
      `, allParams),
      query(`
        SELECT d.name AS department, d.id,
               COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,
               COUNT(*) AS appointment_count
        FROM appointments a JOIN departments d ON d.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id
        WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
        GROUP BY d.id, d.name ORDER BY revenue DESC
      `, allParams),
      query(`
        SELECT TO_CHAR(DATE_TRUNC('month', a.scheduled_at), 'YYYY-MM') AS month,
               d.name AS department,
               COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue,
               COUNT(*) AS appointment_count
        FROM appointments a JOIN departments d ON d.id=a.department_id JOIN clinics cl ON cl.id=a.clinic_id
        WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
        GROUP BY month, d.id, d.name ORDER BY month ASC
      `, allParams),
    ]);

    res.json({
      success: true,
      data: {
        by_city: byCity.rows,
        by_clinic: byClinic.rows,
        by_department: byDept.rows,
        by_month: byMonth.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch revenue analytics' });
  }
});

/**
 * GET /api/v1/analytics/timeseries
 */
router.get('/timeseries', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const scope = getScopeFilter(user);
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = buildDateFilter(dateFrom, dateTo, scope.params.length);
  const allParams = [...scope.params, ...dateFilter.params];

  try {
    const [monthly, weekly, hourly] = await Promise.all([
      query(`
        SELECT TO_CHAR(DATE_TRUNC('month', a.scheduled_at), 'YYYY-MM') AS month,
               COUNT(*) AS appointment_count,
               COALESCE(SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END),0) AS revenue
        FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id
        WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
        GROUP BY month ORDER BY month
      `, allParams),
      query(`
        SELECT EXTRACT(DOW FROM a.scheduled_at)::int AS day_of_week, COUNT(*) AS appointment_count
        FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id
        WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
        GROUP BY day_of_week ORDER BY day_of_week
      `, allParams),
      query(`
        SELECT EXTRACT(DOW FROM a.scheduled_at)::int AS day_of_week,
               EXTRACT(HOUR FROM a.scheduled_at)::int AS hour,
               COUNT(*) AS appointment_count
        FROM appointments a JOIN clinics cl ON cl.id=a.clinic_id
        WHERE 1=1 ${scope.clinicClause} ${dateFilter.clause}
        GROUP BY day_of_week, hour ORDER BY day_of_week, hour
      `, allParams),
    ]);

    res.json({
      success: true,
      data: {
        monthly_volume: monthly.rows,
        daily_of_week_volume: weekly.rows,
        hourly_distribution: hourly.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch timeseries' });
  }
});

export default router;
