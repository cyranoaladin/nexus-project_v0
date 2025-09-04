import { spendCredits } from '@/lib/credits';
import { prisma } from '@/lib/prisma';
import { SpendCreditsSchema } from '@/lib/validation/schemas';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = SpendCreditsSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { userId, usageKey, credits: directCredits, idempotencyKey, metadata } = parsed.data;

  let credits = directCredits || 0;
  let reason = metadata?.reason || (usageKey || 'USAGE');
  if (usageKey && !directCredits) {
    const usage = await (prisma as any).creditUsage.findUnique({ where: { key: usageKey } });
    if (!usage) return NextResponse.json({ error: 'usageKey inconnu' }, { status: 400 });
    credits = usage.credits;
  }

  try {
    const res = await spendCredits({ userId, credits, reason, provider: metadata?.provider, externalId: idempotencyKey });
    return NextResponse.json({ ok: true, balance: res.balance, already: (res as any).already || false });
  } catch (e: any) {
    if (e?.code === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'Crédits insuffisants', balance: e.balance, needed: e.needed }, { status: 402 });
    }
    return NextResponse.json({ error: e?.message || 'Erreur dépense' }, { status: 500 });
  }
}
