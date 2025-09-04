import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
// Stripe supprimé — seuls Konnect, Wire (bientôt) et Cash sont supportés

async function creditUserFromPack(userId: string, packId: number, provider: string, externalId: string) {
  const pack = await (prisma as any).creditPack.findUnique({ where: { id: packId } });
  if (!pack) throw new Error('Pack introuvable');
  const credits = Number(pack.credits) + Number(pack.bonus || 0);
  let wallet = await (prisma as any).creditWallet.findUnique({ where: { userId } });
  if (!wallet) wallet = await (prisma as any).creditWallet.create({ data: { userId, balance: 0 } });
  await (prisma as any).$transaction([
    (prisma as any).creditWallet.update({ where: { id: wallet.id }, data: { balance: { increment: credits } } }),
    (prisma as any).creditTx.create({ data: { walletId: wallet.id, delta: credits, reason: `PACK_${packId}`, provider, externalId, packId } })
  ]);
}

export async function POST(req: NextRequest) {
  const provider = new URL(req.url).searchParams.get('provider');
  if (provider === 'konnect') {
    const search = new URL(req.url).searchParams;
    const payment_ref = search.get('payment_ref') || (await req.json().catch(() => ({} as any)))?.payment_ref;
    if (!payment_ref) return NextResponse.json({ error: 'payment_ref manquant' }, { status: 400 });
    const rec = await (prisma as any).paymentRecord.findFirst({ where: { externalId: payment_ref, provider: 'konnect' } });
    if (!rec) return NextResponse.json({ error: 'record introuvable' }, { status: 404 });
    await (prisma as any).paymentRecord.update({ where: { id: rec.id }, data: { status: 'paid' } });
    await creditUserFromPack(rec.userId, rec.packId, 'konnect', payment_ref);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true });
}
