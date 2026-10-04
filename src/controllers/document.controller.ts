import type { Response } from 'express';
import mongoose from 'mongoose';
import pdf from 'pdf-parse';
import { z } from 'zod';
import { Document } from '../models/Document';
import type { AuthRequest } from '../middleware/auth';
import { DocumentChunk } from '../models/DocumentChunk';
import { processDocumentWithAI } from '../services/document-processing.service';
import { createQueryEmbedding } from '../services/ai.service';

const idSchema = z.string().refine((value) => mongoose.isValidObjectId(value), 'Invalid document ID');

export async function uploadDocumentController(req: AuthRequest, res: Response) {
  if (!req.file) return res.status(400).json({ success: false, message: 'Please select a PDF or TXT file' });
  const file = req.file;
  const extension = file.originalname.toLowerCase().split('.').pop();
  if ((extension === 'pdf' && file.mimetype !== 'application/pdf') || (extension === 'txt' && file.mimetype !== 'text/plain') || !['pdf', 'txt'].includes(extension || '')) {
    return res.status(400).json({ success: false, message: 'File extension and content type must match (PDF or TXT)' });
  }

  let extractedText = '';
  try {
    extractedText = extension === 'pdf'
      ? (await pdf(file.buffer)).text.trim()
      : file.buffer.toString('utf8').trim();
  } catch {
    return res.status(422).json({ success: false, message: 'Could not read this file. Check that it is a valid PDF or UTF-8 text file.' });
  }
  if (!extractedText) return res.status(422).json({ success: false, message: 'No readable text was found in this document' });
  if (extractedText.length > 2_000_000) return res.status(413).json({ success: false, message: 'Extracted text is too large to process' });

  const document = await Document.create({
    owner: req.user!.id,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    extension,
    extractedText,
    status: 'processing'
  });
  let aiMessage = 'AI processing started';
  try {
    const result = await processDocumentWithAI(document.id, req.user!.id, extractedText);
    aiMessage = `AI summary generated and ${result.chunkCount} searchable chunks indexed`;
  } catch (error) {
    aiMessage = error instanceof Error ? error.message : 'AI processing failed';
  }
  const updatedDocument = await Document.findById(document.id);
  return res.status(201).json({ success: true, message: 'Document uploaded and text extracted', aiMessage, data: {
    id: document.id, originalName: document.originalName, mimeType: document.mimeType,
    size: document.size, extension: document.extension, status: updatedDocument?.status || document.status,
    textLength: extractedText.length, summary: updatedDocument?.summary || '', chunkCount: updatedDocument?.chunkCount || 0, aiError: updatedDocument?.aiError || null, createdAt: document.createdAt
  }});
}

export async function listDocuments(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const filter = req.user!.role === 'admin' ? {} : { owner: req.user!.id };
  const [documents, total] = await Promise.all([
    Document.find(filter).select('-extractedText').populate('owner', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Document.countDocuments(filter)
  ]);
  res.json({ success: true, data: documents, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function getDocument(req: AuthRequest, res: Response) {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid document ID' });
  const filter: Record<string, unknown> = { _id: parsed.data };
  if (req.user!.role !== 'admin') filter.owner = req.user!.id;
  const document = await Document.findOne(filter).populate('owner', 'name email');
  if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
  res.json({ success: true, data: document });
}

export async function deleteDocument(req: AuthRequest, res: Response) {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid document ID' });
  const filter: Record<string, unknown> = { _id: parsed.data };
  if (req.user!.role !== 'admin') filter.owner = req.user!.id;
  const document = await Document.findOne(filter);
  if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
  await Promise.all([DocumentChunk.deleteMany({ document: document._id }), document.deleteOne()]);
  res.json({ success: true, message: 'Document deleted' });
}


export async function semanticSearch(req: AuthRequest, res: Response) {
  const parsed = z.object({ q: z.string().trim().min(3).max(1000) }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Search query must be between 3 and 1000 characters' });
  try {
    const vector = await createQueryEmbedding(parsed.data.q);
    const vectorStage: Record<string, unknown> = { index: 'vector_index', path: 'embedding', queryVector: vector, numCandidates: 150, limit: 10 };
    if (req.user!.role !== 'admin') vectorStage.filter = { owner: new mongoose.Types.ObjectId(req.user!.id) };
    const results = await DocumentChunk.aggregate([
      { $vectorSearch: vectorStage },
      { $project: { text: 1, chunkIndex: 1, document: 1, owner: 1, score: { $meta: 'vectorSearchScore' } } },
      { $lookup: { from: 'documents', localField: 'document', foreignField: '_id', as: 'documentInfo' } },
      { $unwind: '$documentInfo' },
      { $project: { text: 1, chunkIndex: 1, score: 1, document: { _id: '$documentInfo._id', originalName: '$documentInfo.originalName', summary: '$documentInfo.summary', createdAt: '$documentInfo.createdAt' } } }
    ] as any);
    res.json({ success: true, query: parsed.data.q, data: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Semantic search failed';
    if (/vectorSearch|index|PlanExecutor/i.test(message)) return res.status(503).json({ success: false, message: 'MongoDB Atlas Vector Search is not configured. Create the vector_index described in docs/ATLAS_VECTOR_INDEX.json, then retry.' });
    throw error;
  }
}
