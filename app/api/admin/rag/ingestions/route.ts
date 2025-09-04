import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE', 'COACH']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const items = await (prisma as any).auditLog.findMany({ where: { action: 'RAG_INGEST' }, orderBy: { at: 'desc' }, take: 50 });
  return NextResponse.json({ items });
}
