import { getJob } from '@/lib/bilan/jobs';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string; }; }) {
  const job = getJob(params.id);
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (job.status !== 'done' || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return NextResponse.json({ error: 'not_ready' }, { status: 409 });
  }
  const buf = fs.readFileSync(job.outputPath);
  return new NextResponse(buf as any, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename=bilan_${job.id}.pdf` } });
}
