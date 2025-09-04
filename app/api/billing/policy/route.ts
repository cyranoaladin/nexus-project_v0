export const dynamic = 'force-dynamic';
import { requireRole } from '@/lib/api/rbac';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  let p = await (prisma as any).billingPolicy.findUnique({ where: { id: 1 } });
  if (!p) p = await (prisma as any).billingPolicy.create({ data: { id: 1 } });
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const body = await req.json();
  const p = await (prisma as any).billingPolicy.upsert({ where: { id: 1 }, update: body, create: { id: 1, ...body } });
  return NextResponse.json(p);
}
