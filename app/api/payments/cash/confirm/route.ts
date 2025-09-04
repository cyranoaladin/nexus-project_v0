import { requireRole } from '@/lib/api/rbac';
import { sendMail } from '@/lib/email';
import { tplCashConfirmed } from '@/lib/email/templates';
import { creditUserFromPack } from '@/lib/payments/credit';
import { prisma } from '@/lib/prisma';
import { getUserEmail } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const { recordId } = await req.json();
  if (!recordId) return NextResponse.json({ error: 'recordId requis' }, { status: 400 });
  const rec = await (prisma as any).paymentRecord.findUnique({ where: { id: Number(recordId) } });
  if (!rec || rec.provider !== 'cash') return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
  if (rec.status === 'paid') return NextResponse.json({ ok: true, message: 'Déjà validé' });
  await (prisma as any).paymentRecord.update({ where: { id: rec.id }, data: { status: 'paid' } });
  await creditUserFromPack(rec.userId, rec.packId, 'cash', 'cash-confirm');
  try {
    const email = await getUserEmail(rec.userId);
    if (email) await sendMail({ to: email, subject: 'Nexus — Paiement validé et crédits ajoutés', html: tplCashConfirmed({ recordId: rec.id }) });
  } catch {}
  return NextResponse.json({ ok: true });
}
