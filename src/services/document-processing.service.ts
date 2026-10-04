import { Document } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { createEmbeddings, createSummary, splitIntoChunks } from './ai.service';

export async function processDocumentWithAI(documentId: string, ownerId: string, text: string) {
  await Document.updateOne({ _id: documentId }, { status: 'processing', aiError: null });
  try {
    const summary = await createSummary(text);
    const chunks = splitIntoChunks(text);
    // Keep provider requests bounded and avoid oversized embedding batches.
    const records: Array<{ document: string; owner: string; chunkIndex: number; text: string; embedding: number[] }> = [];
    for (let offset = 0; offset < chunks.length; offset += 64) {
      const batch = chunks.slice(offset, offset + 64);
      const vectors = await createEmbeddings(batch);
      batch.forEach((chunk, index) => records.push({
        document: documentId, owner: ownerId, chunkIndex: offset + index, text: chunk, embedding: vectors[index]
      }));
    }
    await DocumentChunk.deleteMany({ document: documentId });
    if (records.length) await DocumentChunk.insertMany(records, { ordered: true });
    await Document.updateOne({ _id: documentId }, {
      summary, status: 'completed', chunkCount: records.length, aiError: null,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    });
    return { summary, chunkCount: records.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI processing failed';
    await Document.updateOne({ _id: documentId }, { status: 'failed', aiError: message });
    throw error;
  }
}
