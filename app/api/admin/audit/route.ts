import { requireRole } from '@/lib/api/rbac';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const limit = Number(new URL(req.url).searchParams.get('limit') || 50);
  const items = await (prisma as any).auditLog.findMany({ orderBy: { at: 'desc' }, take: limit });
  return NextResponse.json(items);
}
