import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';

export interface AuthRequest extends Request { user?: { id: string; role: 'user' | 'admin' } }

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as { sub: string };
    const user = await User.findById(payload.sub).select('_id role');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    req.user = { id: user.id, role: user.role as 'user' | 'admin' };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access required' });
  next();
}
