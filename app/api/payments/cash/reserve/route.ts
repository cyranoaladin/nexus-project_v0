import { sendMail } from '@/lib/email';
import { tplCashReserved } from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';
import { upsertPaymentRecord } from '@/lib/payments';
import { getUserEmail } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, packId, amountTnd, note, parentEmail } = await req.json();
  if (!userId || !packId || !amountTnd) return NextResponse.json({ error: 'userId, packId, amountTnd requis' }, { status: 400 });

  const externalId = `cash:reservation:${userId}:${packId}:${Date.now()}`;
  const rec = await upsertPaymentRecord(prisma as any, { provider: 'cash', externalId, userId, packId: Number(packId), amountTnd: Number(amountTnd), currency: 'TND', status: 'pending' });
  try {
    const email = await getUserEmail(userId, parentEmail);
    if (email) await sendMail({ to: email, subject: 'Nexus — Réservation en espèces reçue', html: tplCashReserved({ amountTnd: Number(amountTnd), recordId: rec.id }) });
  } catch {}
  return NextResponse.json({ ok: true, recordId: rec.id, status: rec.status, message: 'Réservation créée — validation après paiement au centre.' });
}
