import multer from 'multer';
import { env } from '../config/env';

const allowed = new Set(['application/pdf', 'text/plain']);
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error('Only PDF and TXT files are allowed'));
    cb(null, true);
  }
});
