import { Router } from 'express';
import mongoose from 'mongoose';
import { redis } from '../config/redis';

const router = Router();
router.get('/', async (_req, res) => {
  let redisStatus = 'disconnected';
  try { await redis.ping(); redisStatus = 'connected'; } catch { /* Redis is optional during initial boot */ }
  res.json({ success: true, data: { api: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', redis: redisStatus } });
});
export default router;
