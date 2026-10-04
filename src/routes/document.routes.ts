import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { uploadDocument } from '../middleware/upload';
import { deleteDocument, getDocument, listDocuments, semanticSearch, uploadDocumentController } from '../controllers/document.controller';

const router = Router();
router.use(requireAuth);
router.post('/upload', uploadDocument.single('file'), uploadDocumentController);
router.get('/search', semanticSearch);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);
export default router;
