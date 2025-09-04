import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, packId, amountTnd } = await req.json();
  if (!userId || !packId || !amountTnd) return NextResponse.json({ error: 'userId, packId, amountTnd requis' }, { status: 400 });
  const rec = await (prisma as any).paymentRecord.create({ data: { provider: 'konnect', externalId: 'konnect-link-pending', userId, packId: Number(packId), amountTnd: Number(amountTnd), currency: 'TND', status: 'pending' } });
  return NextResponse.json({ available: false, message: 'Paiement par carte via Konnect — bientôt disponible', recordId: rec.id }, { status: 501 });
}
