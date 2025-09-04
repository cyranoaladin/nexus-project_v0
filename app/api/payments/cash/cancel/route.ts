import { requireRole } from '@/lib/api/rbac';
import { sendMail } from '@/lib/email';
import { tplCashCancelled } from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';
import { getUserEmail } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const { recordId, parentEmail } = await req.json();
  if (!recordId) return NextResponse.json({ error: 'recordId requis' }, { status: 400 });

  const rec = await (prisma as any).paymentRecord.findUnique({ where: { id: Number(recordId) } });
  if (!rec || rec.provider !== 'cash') return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });

  await (prisma as any).paymentRecord.update({ where: { id: rec.id }, data: { status: 'cancelled' } });

  try {
    const to = await getUserEmail(rec.userId, parentEmail);
    if (to) await sendMail({ to, subject: 'Nexus — Réservation annulée', html: tplCashCancelled({ recordId: rec.id }) });
  } catch {}
  return NextResponse.json({ ok: true });
}
