import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { query } from '../db/pool';
import { AuthPayload } from '../middleware/auth';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
});

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_DAYS = 7;

async function logAudit(userId: number | null, event: string, req: Request, details?: object) {
  await query(
    `INSERT INTO audit_log (user_id, event_type, ip_address, user_agent, details) VALUES ($1,$2,$3,$4,$5)`,
    [userId, event, req.ip, req.headers['user-agent'] || '', JSON.stringify(details || {})]
  );
}

/**
 * POST /api/v1/auth/login
 * Authenticates user and returns access + refresh tokens
 */
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const { email, password } = req.body;

  try {
    const userRes = await query(
      `SELECT id, email, password_hash, role, city_id, clinic_id, is_active FROM users WHERE email = $1`,
      [email]
    );

    if (!userRes.rows[0]) {
      await logAudit(null, 'LOGIN_FAILED', req, { email, reason: 'user_not_found' });
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      res.status(403).json({ success: false, error: 'Account deactivated' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await logAudit(user.id, 'LOGIN_FAILED', req, { reason: 'wrong_password' });
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      cityId: user.city_id,
      clinicId: user.clinic_id,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRY_DAYS);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshHash, expiresAt.toISOString()]
    );

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    await logAudit(user.id, 'LOGIN_SUCCESS', req);

    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, email: user.email, role: user.role, cityId: user.city_id, clinicId: user.clinic_id },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Issues new access token using HttpOnly refresh token cookie
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ success: false, error: 'No refresh token' });
    return;
  }

  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  try {
    const tokenRes = await query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
              u.email, u.role, u.city_id, u.clinic_id, u.is_active
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [refreshHash]
    );

    const record = tokenRes.rows[0];
    if (!record || record.revoked || new Date(record.expires_at) < new Date() || !record.is_active) {
      res.clearCookie('refresh_token', { path: '/api/v1/auth' });
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    // Rotation: revoke old, issue new
    await query(`UPDATE refresh_tokens SET revoked = true WHERE id = $1`, [record.id]);

    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRY_DAYS);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [record.user_id, newHash, expiresAt.toISOString()]
    );

    const payload: AuthPayload = {
      userId: record.user_id,
      email: record.email,
      role: record.role,
      cityId: record.city_id,
      clinicId: record.clinic_id,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query(`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, [hash]);
  }
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  res.json({ success: true, data: null });
});

export default router;
