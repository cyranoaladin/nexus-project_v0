export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string; reservationId: string }> }
) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  const { reservationId } = await params;

  try {
    const reservation = await prisma.stageReservation.findUnique({
      where: { id: reservationId },
      include: { stage: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }
    if (reservation.richStatus === 'CONFIRMED') {
      return NextResponse.json({ error: 'Déjà confirmée' }, { status: 409 });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    let user = await prisma.user.findUnique({ where: { email: reservation.email } });
    if (!user) {
      const tempPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: reservation.email,
          firstName: reservation.studentName?.split(' ')[0] ?? reservation.parentName.split(' ')[0],
          lastName: reservation.studentName?.split(' ')[1] ?? reservation.parentName.split(' ')[1] ?? '',
          role: 'ELEVE',
          password: tempPass,
        },
      });
    }

    await prisma.stageReservation.update({
      where: { id: reservation.id },
      data: {
        richStatus: 'CONFIRMED',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        activationToken: hashedToken,
        activationTokenExpiresAt: expiresAt,
        paymentStatus: 'COMPLETED',
      },
    });

    const stageTitle = reservation.stage?.title ?? 'Stage Nexus';
    const firstName = reservation.studentName?.split(' ')[0] ?? reservation.parentName.split(' ')[0];
    const activationUrl = `${process.env.NEXTAUTH_URL}/auth/activate?token=${rawToken}&source=stage`;

    await sendMail({
      to: reservation.email,
      subject: `✅ Inscription confirmée — ${stageTitle}`,
      html: `<p>Bonjour ${firstName},</p>
             <p>Votre inscription au <strong>${stageTitle}</strong> est <strong>confirmée</strong>.</p>
             <p>Créez votre compte Nexus Réussite pour accéder à votre emploi du temps,
             vos ressources et votre bilan :</p>
             <p><a href="${activationUrl}" style="background:#4f46e5;color:white;padding:12px 24px;
             border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">
             Activer mon compte</a></p>
             <p style="color:#6b7280;font-size:14px;">Ce lien est valable 72 heures.</p>`,
    });

    return NextResponse.json({
      success: true,
      message: "Réservation confirmée et email d'activation envoyé.",
    });
  } catch (error) {
    console.error('[POST confirm reservation]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
