import { connection } from '@/lib/queue';
import { Queue } from 'bullmq';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // BullMQ n'autorise pas ':' dans le nom de queue lors du build SSR
    const q = new Queue('rag_ingest', { connection });
    const [active, waiting, failed, completed, delayed] = await Promise.all([
      q.getActive(), q.getWaiting(), q.getFailed(), q.getCompleted(), q.getDelayed()
    ]);
    const counts = await q.getJobCounts('active', 'waiting', 'failed', 'completed', 'delayed');
    const stats = { counts };
    return NextResponse.json({ stats, active, waiting, failed: failed.slice(-10), completed: completed.slice(-10), delayed });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
