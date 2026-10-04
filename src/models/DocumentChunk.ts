import { Schema, model } from 'mongoose';

const documentChunkSchema = new Schema({
  document: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true }
}, { timestamps: true });

documentChunkSchema.index({ document: 1, chunkIndex: 1 }, { unique: true });
export const DocumentChunk = model('DocumentChunk', documentChunkSchema);
