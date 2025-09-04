export const dynamic = 'force-dynamic';
import { requireRole } from '@/lib/api/rbac';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const items = await (prisma as any).offerBinding.findMany();
  return NextResponse.json(items);
}

export async function PUT(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const { offers } = await req.json() as { offers: Array<{ code: string; label: string; includeAria: boolean; pricingRefs: { variable: string; label: string; }[]; }>; };
  const tx = offers.map(o => (prisma as any).offerBinding.upsert({
    where: { code: o.code },
    update: { label: o.label, includeAria: o.includeAria, refs: o.pricingRefs },
    create: { code: o.code, label: o.label, includeAria: o.includeAria, refs: o.pricingRefs }
  }));
  await (prisma as any).$transaction(tx);
  return NextResponse.json({ ok: true });
}
