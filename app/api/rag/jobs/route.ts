import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const jobs = await prisma.ingestJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, docId: true, status: true, step: true, progress: true, error: true, createdAt: true },
    });
    return NextResponse.json({ jobs });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
