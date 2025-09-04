import { requireRole } from '@/lib/api/rbac';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: { id: string; }; }) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const body = await req.json();
  const updated = await (prisma as any).creditPack.update({ where: { id: Number(params.id) }, data: body });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; }; }) {
  const guard = await requireRole(req, ['ADMIN']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  await (prisma as any).creditPack.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
