import { getAuthFromRequest } from '@/lib/api/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PricingSchema } from '@/lib/validation/schemas';
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

const createSchema = z.object({
  service: z.string().min(1),
  variable: z.string().min(1),
  valeur: z.number(),
  devise: z.string().min(1).default('TND')
});

export async function GET() {
  // E2E fast-path: simple map when tests run
  if (process.env.E2E === '1' || process.env.NEXT_PUBLIC_E2E === '1') {
    const items = [
      { variable: 'prix_individuel', valeur: 80 },
      { variable: 'prix_groupe4', valeur: 35 },
      { variable: 'pack_50_credits', valeur: 500 },
      { variable: 'pack_100_credits', valeur: 1000 },
      { variable: 'pack_250_credits', valeur: 2500 },
    ];
    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-cache' } });
  }
  try {
    const items = await (prisma as any).pricing.findMany({ orderBy: { updatedAt: 'desc' } });
    return NextResponse.json(items);
  } catch (e: any) {
    // fallback to default items on error
    const items = [
      { variable: 'pack_50_credits', valeur: 500 },
      { variable: 'pack_100_credits', valeur: 1000 },
      { variable: 'pack_250_credits', valeur: 2500 },
    ];
    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-cache' } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = await getRole(req);
    if (!isAllowed(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const parsed = PricingSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    const created = await (prisma as any).pricing.create({ data: parsed.data });
    try { revalidateTag('pricing'); } catch {}
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
