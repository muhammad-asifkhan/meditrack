import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';

export interface AuthPayload {
  userId: number;
  email: string;
  role: 'superadmin' | 'city_manager' | 'clinic_staff';
  cityId: number | null;
  clinicId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// Build scope filter based on role
export function getScopeFilter(user: AuthPayload): {
  cityClause: string;
  clinicClause: string;
  params: (number | null)[];
  paramOffset: number;
} {
  if (user.role === 'superadmin') {
    return { cityClause: '', clinicClause: '', params: [], paramOffset: 0 };
  }
  if (user.role === 'city_manager' && user.cityId) {
    return {
      cityClause: 'AND cl.city_id = $1',
      clinicClause: 'AND a.clinic_id IN (SELECT id FROM clinics WHERE city_id = $1)',
      params: [user.cityId],
      paramOffset: 1,
    };
  }
  if (user.role === 'clinic_staff' && user.clinicId) {
    return {
      cityClause: 'AND cl.id = $1',
      clinicClause: 'AND a.clinic_id = $1',
      params: [user.clinicId],
      paramOffset: 1,
    };
  }
  return { cityClause: 'AND 1=0', clinicClause: 'AND 1=0', params: [], paramOffset: 0 };
}
