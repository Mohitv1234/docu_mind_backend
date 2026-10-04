import { Schema, model } from 'mongoose';

const documentSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true, trim: true },
  mimeType: { type: String, enum: ['application/pdf', 'text/plain'], required: true },
  size: { type: Number, required: true, min: 1 },
  extension: { type: String, enum: ['pdf', 'txt'], required: true },
  extractedText: { type: String, required: true },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  summary: { type: String, default: '' },
  aiError: { type: String, default: null },
  chunkCount: { type: Number, default: 0 },
  embeddingModel: { type: String, default: '' }
}, { timestamps: true });

documentSchema.index({ owner: 1, createdAt: -1 });
export const Document = model('Document', documentSchema);
