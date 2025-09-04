import { getJob } from '@/lib/bilan/jobs';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string; }; }) {
  const job = getJob(params.id);
  if (!job) return NextResponse.json({ status: 'error', error: 'not_found' }, { status: 404 });
  return NextResponse.json({ status: job.status, id: job.id, variant: job.variant });
}
