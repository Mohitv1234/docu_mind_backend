import OpenAI from 'openai';
import { env } from '../config/env';

let client: OpenAI | null = null;
function openai() {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured. Add your key to backend/.env.');
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

export function splitIntoChunks(text: string, chunkSize = 1200, overlap = 180): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(' ', end);
      if (boundary > start + Math.floor(chunkSize * 0.65)) end = boundary;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export async function createSummary(text: string): Promise<string> {
  const response = await openai().chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'Summarize the supplied document faithfully. Do not invent facts. Return a concise summary with a short overview and key points. If the text is incomplete or ambiguous, say so.' },
      { role: 'user', content: text.slice(0, 100_000) }
    ]
  });
  const summary = response.choices[0]?.message?.content?.trim();
  if (!summary) throw new Error('The AI provider returned an empty summary.');
  return summary;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai().embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: texts,
    encoding_format: 'float'
  });
  return response.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
}

export async function createQueryEmbedding(text: string): Promise<number[]> {
  const [embedding] = await createEmbeddings([text]);
  return embedding;
}
