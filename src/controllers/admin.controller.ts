import type { Response } from 'express';
import mongoose from 'mongoose';
import { Document } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { User } from '../models/User';
import type { AuthRequest } from '../middleware/auth';
import { processDocumentWithAI } from '../services/document-processing.service';

export async function getAdminStats(_req: AuthRequest, res: Response) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [users, documents, chunks, storage, statuses, recentUploads] = await Promise.all([
    User.countDocuments(),
    Document.countDocuments(),
    DocumentChunk.countDocuments(),
    Document.aggregate([{ $group: { _id: null, bytes: { $sum: '$size' } } }]),
    Document.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Document.countDocuments({ createdAt: { $gte: sevenDaysAgo } })
  ]);

  const statusCounts = { processing: 0, completed: 0, failed: 0 };
  for (const item of statuses) {
    if (item._id in statusCounts) statusCounts[item._id as keyof typeof statusCounts] = item.count;
  }

  return res.json({
    success: true,
    data: {
      users,
      documents,
      chunks,
      storageBytes: storage[0]?.bytes || 0,
      recentUploads,
      statuses: statusCounts
    }
  });
}

export async function refreshDocumentSummary(req: AuthRequest, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid document ID' });
  const document = await Document.findById(req.params.id);
  if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
  try {
    const result = await processDocumentWithAI(document.id, document.owner.toString(), document.extractedText);
    const updated = await Document.findById(document.id).select('summary status chunkCount aiError');
    return res.json({ success: true, message: 'Summary and embeddings regenerated', data: updated, chunkCount: result.chunkCount });
  } catch (error) {
    return res.status(502).json({ success: false, message: error instanceof Error ? error.message : 'AI processing failed' });
  }
}
