import { requireRole } from '@/lib/api/rbac';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const items = await (prisma as any).paymentRecord.findMany({ where: { provider: 'cash', status: 'pending' }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(items);
}
