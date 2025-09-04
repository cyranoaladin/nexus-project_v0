export const dynamic = 'force-dynamic';
import { requireRole } from '@/lib/api/rbac';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  let s = await (prisma as any).paymentSettings.findUnique({ where: { id: 1 } });
  if (!s) s = await (prisma as any).paymentSettings.create({ data: { id: 1 } });
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const body = await req.json();
  const s = await (prisma as any).paymentSettings.upsert({ where: { id: 1 }, update: body, create: { id: 1, ...body } });
  return NextResponse.json(s);
}
