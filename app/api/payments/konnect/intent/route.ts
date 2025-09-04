import { prisma } from '@/lib/prisma';
import { upsertPaymentRecord } from '@/lib/payments';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, packId, amountTnd } = await req.json();
  if (!userId || !packId || !amountTnd) return NextResponse.json({ error: 'userId, packId, amountTnd requis' }, { status: 400 });

  const externalId = `konnect:intent:${userId}:${packId}:${Date.now()}`;
  const rec = await upsertPaymentRecord(prisma as any, { provider: 'konnect', externalId, userId, packId: Number(packId), amountTnd: Number(amountTnd), currency: 'TND', status: 'pending' });
  return NextResponse.json({ available: false, message: 'Paiement par carte via Konnect — bientôt disponible', recordId: rec.id }, { status: 501 });
}
