import { Router, Request, Response } from 'express';
import { authenticate, getScopeFilter } from '../middleware/auth';
import { query } from '../db/pool';
import { createObjectCsvStringifier } from 'csv-writer';

const router = Router();
router.use(authenticate);

/**
 * GET /api/v1/reports/export
 * Exports data as CSV or simple HTML report
 */
router.get('/export', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const scope = getScopeFilter(user);
  const { type = 'appointments', format = 'csv', date_from, date_to, city_id, clinic_id } = req.query as Record<string, string>;

  const params = [...scope.params];
  let scopeFilter = scope.clinicClause;
  let dateFilter = '';

  if (date_from) { (params as unknown[]).push(date_from); dateFilter += ` AND a.scheduled_at >= $${params.length}`; }
  if (date_to) { (params as unknown[]).push(date_to); dateFilter += ` AND a.scheduled_at <= $${params.length}`; }
  if (city_id && user.role === 'superadmin') { (params as unknown[]).push(city_id); scopeFilter += ` AND cl.city_id = $${params.length}`; }
  if (clinic_id) { (params as unknown[]).push(clinic_id); scopeFilter += ` AND a.clinic_id = $${params.length}`; }

  try {
    let rows: Record<string, unknown>[] = [];

    if (type === 'appointments') {
      const result = await query(`
        SELECT a.id, TO_CHAR(a.scheduled_at, 'YYYY-MM-DD HH24:MI') AS scheduled_at,
               a.status, a.consultation_fee,
               doc.name AS doctor, dept.name AS department,
               cl.name AS clinic, ci.name AS city,
               p.name AS patient, p.phone
        FROM appointments a
        JOIN doctors doc ON doc.id = a.doctor_id
        JOIN departments dept ON dept.id = a.department_id
        JOIN clinics cl ON cl.id = a.clinic_id
        JOIN cities ci ON ci.id = cl.city_id
        JOIN patients p ON p.id = a.patient_id
        WHERE 1=1 ${scopeFilter} ${dateFilter}
        ORDER BY a.scheduled_at DESC LIMIT 5000
      `, params);
      rows = result.rows;
    } else if (type === 'department') {
      const result = await query(`
        SELECT d.name AS department,
               COUNT(*) AS total_appointments,
               SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END) AS revenue,
               ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),1) AS no_show_rate,
               ROUND(100.0*SUM(CASE WHEN a.status='cancelled' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),1) AS cancellation_rate
        FROM appointments a
        JOIN departments d ON d.id = a.department_id
        JOIN clinics cl ON cl.id = a.clinic_id
        WHERE 1=1 ${scopeFilter} ${dateFilter}
        GROUP BY d.name ORDER BY revenue DESC
      `, params);
      rows = result.rows;
    } else if (type === 'doctor') {
      const result = await query(`
        SELECT doc.name AS doctor, doc.seniority_level, dept.name AS department, cl.name AS clinic,
               COUNT(*) AS appointments,
               SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END) AS revenue,
               ROUND(100.0*SUM(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),1) AS no_show_rate
        FROM appointments a
        JOIN doctors doc ON doc.id = a.doctor_id
        JOIN departments dept ON dept.id = a.department_id
        JOIN clinics cl ON cl.id = a.clinic_id
        WHERE 1=1 ${scopeFilter} ${dateFilter}
        GROUP BY doc.id, doc.name, doc.seniority_level, dept.name, cl.name
        ORDER BY revenue DESC
      `, params);
      rows = result.rows;
    } else if (type === 'revenue') {
      const result = await query(`
        SELECT TO_CHAR(DATE_TRUNC('month',a.scheduled_at),'YYYY-MM') AS month,
               ci.name AS city, d.name AS department,
               SUM(CASE WHEN a.status='completed' THEN a.consultation_fee ELSE 0 END) AS revenue,
               COUNT(*) AS appointments
        FROM appointments a
        JOIN clinics cl ON cl.id = a.clinic_id
        JOIN cities ci ON ci.id = cl.city_id
        JOIN departments d ON d.id = a.department_id
        WHERE 1=1 ${scopeFilter} ${dateFilter}
        GROUP BY month, ci.name, d.name ORDER BY month, revenue DESC
      `, params);
      rows = result.rows;
    }

    // Log the export
    await query(
      `INSERT INTO audit_log (user_id, event_type, details) VALUES ($1, 'EXPORT', $2)`,
      [user.userId, JSON.stringify({ type, format, date_from, date_to, rows_exported: rows.length })]
    );

    if (format === 'csv' && rows.length > 0) {
      const headers = Object.keys(rows[0]).map(k => ({ id: k, title: k.toUpperCase().replace(/_/g, ' ') }));
      const csvStringifier = createObjectCsvStringifier({ header: headers });
      const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="meditrack_${type}_export.csv"`);
      res.send(csv);
    } else {
      // Return JSON if not CSV
      res.json({ success: true, data: rows, meta: { total: rows.length } });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Export failed' });
  }
});

export default router;
