export const dynamic = 'force-dynamic';

import { createActivationToken } from '@/lib/auth/activation-token';
import { buildTrustedActivationUrl } from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeUserEmail } from '@/lib/contact/user-email';

const confirmReservationParamsSchema = z.object({
  stageSlug: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]*$/),
  reservationId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

const confirmReservationBodySchema = z.object({
  studentId: z.string().trim().min(1).max(100),
}).strict();

/**
 * Confirmer une réservation de stage exige désormais un `Student.id`
 * canonique déjà résolu (recherché par le staff dans le panneau élèves) :
 * cette route ne crée plus jamais de `User`/`Student` ni ne s'appuie sur le
 * "parent technique" (`SYSTEM_PARENT_EMAIL`). Amendement 6 -- seuls
 * `createFamily()` et `addChildToExistingFamily()` créent des identités
 * PARENT/ELEVE.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string; reservationId: string }> }
) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  const parsedParams = confirmReservationParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Paramètres de réservation invalides' }, { status: 400 });
  }
  const { stageSlug, reservationId } = parsedParams.data;

  let studentId: string | undefined;
  try {
    const raw = await req.json();
    const parsedBody = confirmReservationBodySchema.safeParse(raw);
    if (parsedBody.success) studentId = parsedBody.data.studentId;
  } catch {
    // No/invalid JSON body: studentId stays undefined and is rejected below.
  }

  if (!studentId) {
    return NextResponse.json(
      {
        error: 'STUDENT_LINK_REQUIRED',
        message: "Un élève (Student.id) doit être résolu et fourni pour confirmer cette réservation.",
      },
      { status: 400 },
    );
  }

  try {
    const reservation = await prisma.stageReservation.findFirst({
      where: {
        id: reservationId,
        stage: { slug: stageSlug },
      },
      include: { stage: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }
    if (reservation.richStatus === 'CONFIRMED') {
      return NextResponse.json({ error: 'Déjà confirmée' }, { status: 409 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!student) {
      return NextResponse.json(
        { error: 'STUDENT_NOT_FOUND', message: 'Aucun élève ne correspond à cet identifiant.' },
        { status: 404 },
      );
    }

    const reservationEmail = normalizeUserEmail(reservation.email);
    const stageTitle = reservation.stage?.title ?? 'Stage Nexus';
    const firstName = student.user.firstName ?? reservation.studentName?.split(' ')[0] ?? reservation.parentName.split(' ')[0];

    // Un compte déjà activé a un vrai mot de passe et une session vivante :
    // cette route ne doit jamais réémettre de jeton d'activation qui
    // révoquerait cet état pour un simple ré-appel de confirmation.
    const needsActivation = student.user.activatedAt === null;
    const token = needsActivation ? createActivationToken('student') : null;
    const activationUrl = token
      ? buildTrustedActivationUrl(token.rawToken, 'stage', 'student').toString()
      : null;

    let alreadyConfirmed = false;
    await prisma.$transaction(async (tx) => {
      // CAS sur richStatus : deux confirmations concurrentes/rejouées ne
      // doivent attacher l'élève et envoyer le mail qu'une seule fois.
      const updated = await tx.stageReservation.updateMany({
        where: { id: reservation.id, richStatus: { not: 'CONFIRMED' } },
        data: {
          richStatus: 'CONFIRMED',
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          studentId: student.id,
          paymentStatus: 'COMPLETED',
          ...(token ? { activationToken: token.tokenHash, activationTokenExpiresAt: token.expiresAt } : {}),
        },
      });
      if (updated.count !== 1) {
        alreadyConfirmed = true;
        return;
      }

      if (token) {
        await tx.user.update({
          where: { id: student.userId },
          data: { activationToken: token.tokenHash, activationExpiry: token.expiresAt },
        });
      }

      await enqueueEmailIntent(tx, {
        aggregateType: 'STAGE_RESERVATION',
        aggregateId: reservation.id,
        messageType: 'STUDENT_ACTIVATION',
        dedupeKey: token ? token.tokenHash : `stage-confirm:${reservation.id}`,
        to: reservationEmail,
        subject: `✅ Inscription confirmée — ${stageTitle}`,
        html: token
          ? `<p>Bonjour ${firstName},</p>
             <p>Votre inscription au <strong>${stageTitle}</strong> est <strong>confirmée</strong>.</p>
             <p>Créez votre compte Nexus Réussite pour accéder à votre emploi du temps,
             vos ressources et votre bilan :</p>
             <p><a href="${activationUrl}" style="background:#4f46e5;color:white;padding:12px 24px;
             border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">
             Activer mon compte</a></p>
             <p style="color:#6b7280;font-size:14px;">Ce lien est valable 72 heures.</p>`
          : `<p>Bonjour ${firstName},</p>
             <p>Votre inscription au <strong>${stageTitle}</strong> est <strong>confirmée</strong>.</p>`,
      });
    });

    if (alreadyConfirmed) {
      return NextResponse.json({ error: 'Déjà confirmée' }, { status: 409 });
    }

    kickEmailOutboxDrain();

    return NextResponse.json({
      success: true,
      message: needsActivation
        ? "Réservation confirmée et email d'activation envoyé."
        : 'Réservation confirmée.',
    });
  } catch (error) {
    console.error('[POST confirm reservation]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
