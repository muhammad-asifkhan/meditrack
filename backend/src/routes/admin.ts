import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth';
import { query } from '../db/pool';

const router = Router();
router.use(authenticate);

/**
 * GET /api/v1/admin/users
 */
router.get('/users', requireRole('superadmin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.role, u.is_active, u.created_at,
             c.name AS city_name, cl.name AS clinic_name
      FROM users u
      LEFT JOIN cities c ON c.id = u.city_id
      LEFT JOIN clinics cl ON cl.id = u.clinic_id
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/v1/admin/users
 */
router.post('/users', requireRole('superadmin'), [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['superadmin', 'city_manager', 'clinic_staff']),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

  const { email, password, role, city_id, clinic_id } = req.body;

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, password_hash, role, city_id, clinic_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, role`,
      [email, hash, role, city_id || null, clinic_id || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') { res.status(409).json({ success: false, error: 'Email already exists' }); return; }
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * PATCH /api/v1/admin/users/:id
 */
router.patch('/users/:id', requireRole('superadmin'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { is_active, role, city_id, clinic_id } = req.body;
  try {
    await query(
      `UPDATE users SET is_active=COALESCE($1,is_active), role=COALESCE($2,role),
       city_id=COALESCE($3,city_id), clinic_id=COALESCE($4,clinic_id), updated_at=NOW()
       WHERE id=$5`,
      [is_active, role, city_id, clinic_id, id]
    );
    res.json({ success: true, data: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * GET /api/v1/admin/audit-log
 */
router.get('/audit-log', requireRole('superadmin'), async (req: Request, res: Response): Promise<void> => {
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '50');
  const offset = (page - 1) * limit;

  try {
    const [data, count] = await Promise.all([
      query(`
        SELECT al.id, al.event_type, al.ip_address, al.created_at, al.details,
               u.email AS user_email, u.role AS user_role
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      query(`SELECT COUNT(*) FROM audit_log`),
    ]);

    res.json({
      success: true,
      data: data.rows,
      meta: { total: parseInt(count.rows[0].count), page, limit },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /api/v1/admin/reference - Cities, clinics, departments for dropdowns
 */
router.get('/reference', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [cities, clinics, departments, doctors, patients] = await Promise.all([
      query(`SELECT id, name FROM cities ORDER BY name`),
      query(`SELECT id, city_id, name FROM clinics ORDER BY name`),
      query(`SELECT id, name FROM departments ORDER BY name`),
      query(`SELECT id, clinic_id, department_id, name, seniority_level FROM doctors ORDER BY name`),
      query(`SELECT id, name, phone FROM patients ORDER BY name LIMIT 200`),
    ]);
    res.json({
      success: true,
      data: {
        cities: cities.rows,
        clinics: clinics.rows,
        departments: departments.rows,
        doctors: doctors.rows,
        patients: patients.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch reference data' });
  }
});

export default router;
