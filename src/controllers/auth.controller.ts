import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { User } from '../models/User';
import type { AuthRequest } from '../middleware/auth';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72)
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

function issueToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export async function register(req: AuthRequest, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid registration details', errors: parsed.error.flatten().fieldErrors });
  const email = parsed.data.email.toLowerCase();
  if (await User.exists({ email })) return res.status(409).json({ success: false, message: 'An account with this email already exists' });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await User.create({ name: parsed.data.name, email, passwordHash, role: 'user' });
  return res.status(201).json({ success: true, data: { token: issueToken(user.id), user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
}

export async function login(req: AuthRequest, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid login details' });
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ success: false, message: 'Email or password is incorrect' });
  return res.json({ success: true, data: { token: issueToken(user.id), user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await User.findById(req.user?.id).select('name email role createdAt');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json({ success: true, data: user });
}
