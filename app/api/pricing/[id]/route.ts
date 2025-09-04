import { getAuthFromRequest } from '@/lib/api/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PricingPatchSchema } from '@/lib/validation/schemas';
import { getServerSession } from 'next-auth';
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function isAllowed(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'ASSISTANTE';
}

async function getRole(req: NextRequest): Promise<string | null> {
  const dev = await getAuthFromRequest(req as unknown as Request);
  if (dev?.user?.role) return dev.user.role as string;
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role ?? null;
}

const patchSchema = z.object({
  service: z.string().min(1).optional(),
  variable: z.string().min(1).optional(),
  valeur: z.number().optional(),
  devise: z.string().min(1).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string; }; }) {
  try {
    const role = await getRole(req);
    if (!isAllowed(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const body = await req.json();
    const parsed = PricingPatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    const updated = await (prisma as unknown as any).pricing.update({ where: { id }, data: parsed.data });
    try { revalidateTag('pricing'); } catch {}
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; }; }) {
  try {
    const role = await getRole(req);
    if (!isAllowed(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    await (prisma as unknown as any).pricing.delete({ where: { id } });
    try { revalidateTag('pricing'); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
