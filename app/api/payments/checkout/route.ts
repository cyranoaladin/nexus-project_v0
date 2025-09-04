import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { provider, userId, packId, amountTnd, successUrl, cancelUrl } = await req.json();
  if (!provider || !userId || !packId || !amountTnd) return NextResponse.json({ error: 'provider,userId,packId,amountTnd requis' }, { status: 400 });
  const rec = await (prisma as any).paymentRecord.create({ data: { provider, userId, packId: Number(packId), amountTnd: Number(amountTnd), externalId: 'pending' } });

  // Stripe retiré: paiement carte en TND via Konnect uniquement (bientôt disponible)
  if (provider === 'konnect') {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const url = successUrl || `${baseUrl}/paiement/carte`;
    return NextResponse.json({ ok: true, provider: 'konnect', recordId: rec.id, url, message: 'Paiement carte (Konnect) — bientôt disponible' });
  }
  return NextResponse.json({ error: 'provider invalide' }, { status: 400 });
}
