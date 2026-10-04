import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { getAdminStats, refreshDocumentSummary } from '../controllers/admin.controller';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/stats', getAdminStats);
router.post('/refresh-summary/:id', refreshDocumentSummary);
export default router;
