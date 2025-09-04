import { generateConsistencyReport } from '@/lib/consistency';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report = await generateConsistencyReport(prisma);
  return NextResponse.json(report, { status: report.ok ? 200 : 500 });
}
