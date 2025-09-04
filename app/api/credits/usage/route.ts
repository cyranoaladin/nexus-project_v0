import { requireRole } from '@/lib/api/rbac';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const items = await (prisma as any).creditUsage.findMany({ orderBy: { key: 'asc' } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const body = await req.json();
  const created = await (prisma as any).creditUsage.create({ data: body });
  return NextResponse.json(created);
}
