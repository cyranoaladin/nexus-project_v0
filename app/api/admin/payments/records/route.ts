import { requireRole } from '@/lib/api/rbac';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') || undefined; // 'cash' | 'konnect'
  const status = url.searchParams.get('status') || undefined;     // 'pending' | 'paid' | 'failed' | 'cancelled'
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);

  const where: any = {};
  if (provider) where.provider = provider;
  if (status) where.status = status;

  const records = await (prisma as any).paymentRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json(records);
}
