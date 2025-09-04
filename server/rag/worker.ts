import { createStorageFromEnv } from '@/apps/web/lib/storage';
import { prisma } from '@/lib/prisma';
import { registerIngestWorker } from '@/lib/queue';
import { embedTexts } from '@/server/vector/embeddings';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';

async function handleIngest({ tmpPath, destKey, subject, level }: { tmpPath: string; destKey: string; subject?: string; level?: string; }) {
  const storage = createStorageFromEnv();
  const url = await storage.put(tmpPath, destKey);
  const buf = await fs.readFile(tmpPath);
  const ext = destKey.split('.').pop()?.toLowerCase();
  const isPdf = ext === 'pdf';
  const isDocx = ext === 'docx';
  const text = isPdf ? (await (await import('pdf-parse')).default(buf as any)).text : isDocx ? 'DOCX ingestion (text handled upstream as needed)' : (await fs.readFile(tmpPath, 'utf8')).toString();
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 1000) chunks.push(text.slice(i, i + 1000));
  const vectors = await embedTexts(chunks);
  await prisma.$transaction(vectors.map((v, i) => prisma.$executeRawUnsafe(
    `INSERT INTO "knowledge_assets" (id, "docId", subject, level, chunk, tokens, embedding, meta, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb, NOW())`,
    randomUUID(), destKey, subject || '', level || '', chunks[i], chunks[i].length, `[${v.join(',')}]`, JSON.stringify({ index: i })
  )));
  try { await fs.unlink(tmpPath); } catch {}
  console.log('[worker] ingested', destKey, 'assets=', vectors.length, 'url=', url);
}

export function startIngestWorker() {
  return registerIngestWorker(handleIngest);
}

// Auto-start when WORKER_ENABLED=true
if (process.env.WORKER_ENABLED === 'true') {
  startIngestWorker();
}
