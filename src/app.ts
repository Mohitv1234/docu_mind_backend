import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
import adminRoutes from './routes/admin.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof Error && err.name === 'MulterError') return res.status(400).json({ success: false, message: err.message === 'File too large' ? 'File exceeds the 5 MB limit' : err.message });
  if (err instanceof Error && /Only PDF and TXT/.test(err.message)) return res.status(400).json({ success: false, message: err.message });
  next(err);
});
app.use(errorHandler);
