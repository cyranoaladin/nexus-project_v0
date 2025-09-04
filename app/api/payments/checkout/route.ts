import { prisma } from '@/lib/prisma';
import { upsertPaymentRecord } from '@/lib/payments';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { provider, userId, packId, amountTnd, successUrl, cancelUrl } = await req.json();
  if (!provider || !userId || !packId || !amountTnd) return NextResponse.json({ error: 'provider,userId,packId,amountTnd requis' }, { status: 400 });

  // Use a unique externalId to avoid collisions and ensure idempotency if retried with same key
  const externalId = `${provider}:checkout:${userId}:${packId}:${Date.now()}`;
  const rec = await upsertPaymentRecord(prisma as any, { provider, externalId, userId, packId: Number(packId), amountTnd: Number(amountTnd), status: 'pending' });

  // Stripe retiré: paiement carte en TND via Konnect uniquement (bientôt disponible)
  if (provider === 'konnect') {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const url = successUrl || `${baseUrl}/paiement/carte`;
    return NextResponse.json({ ok: true, provider: 'konnect', recordId: rec.id, url, message: 'Paiement carte (Konnect) — bientôt disponible' });
  }
  return NextResponse.json({ error: 'provider invalide' }, { status: 400 });
}
