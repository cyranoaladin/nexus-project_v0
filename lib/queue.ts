import { JobsOptions, Queue, QueueEvents, Worker } from 'bullmq';

// Ne pas init Redis pendant le build ou en E2E si demandé
const SKIP_REDIS = process.env.SKIP_REDIS === '1' || process.env.E2E === '1';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: any | undefined;
try {
  if (!SKIP_REDIS) {
    // Import dynamique pour éviter la résolution au build
    const IORedis = require('ioredis');
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  }
} catch {
  connection = undefined;
}

export type IngestJobData = { tmpPath: string; destKey: string; subject?: string; level?: string; };

const ingestQueueReal = connection ? new Queue<IngestJobData>('rag_ingest', { connection: connection as any }) : undefined;
export const ingestQueue: any = ingestQueueReal || {
  add: async (_name: string, data: IngestJobData) => ({ id: `inline-${Date.now()}`, data })
};

export const ingestEvents: any = connection ? new QueueEvents('rag_ingest', { connection: connection as any }) : undefined;

export async function enqueueIngest(job: IngestJobData, opts?: JobsOptions) {
  return ingestQueue.add('ingest', job, { removeOnComplete: 100, removeOnFail: 100, attempts: 2, backoff: { type: 'exponential', delay: 2000 }, ...(opts || {}) });
}

export function registerIngestWorker(handler: (data: IngestJobData) => Promise<void>) {
  if (!connection) return undefined as any;
  const worker = new Worker<IngestJobData>('rag_ingest', async (job) => handler(job.data), { connection: connection as any, concurrency: 3 });
  worker.on('failed', (j, err) => console.error('[INGEST][FAILED]', j?.id, err?.message));
  worker.on('completed', (j) => console.log('[INGEST][DONE]', j?.id));
  return worker;
}

// Exporter connection pour compatibilité avec les imports existants
export { connection };
