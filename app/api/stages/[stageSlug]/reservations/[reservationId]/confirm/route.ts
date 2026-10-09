export const dynamic = 'force-dynamic';

import { createActivationToken } from '@/lib/auth/activation-token';
import { buildTrustedActivationUrl } from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { requireAnyRole } from '@/lib/guards';
import { checkCsrf } from '@/lib/csrf';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { privateStageReadHeaders } from '@/lib/stages/family-read-projection';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { escapeHtml } from '@/lib/email/templates';
import { normalizeUserEmail, hasUserEmail } from '@/lib/contact/user-email';

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
async function confirmReservation(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string; reservationId: string }> }
) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (sessionOrError instanceof NextResponse) return privateResponse(sessionOrError);
  if (checkCsrf(req)) return privateJson({ error: 'Accès refusé' }, { status: 403 });

  const parsedParams = confirmReservationParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return privateJson({ error: 'Paramètres de réservation invalides' }, { status: 400 });
  }
  const { stageSlug, reservationId } = parsedParams.data;

  const rateRefusal = await guardSensitiveRateLimit(req, { scope: 'stage-confirmation', identity: sessionOrError.user.id, resource: reservationId });
  if (rateRefusal) return privateResponse(rateRefusal);

  let studentId: string | undefined;
  try {
    const raw: unknown = JSON.parse(await readBoundedRequestBody(req, 2048));
    const parsedBody = confirmReservationBodySchema.safeParse(raw);
    if (parsedBody.success) studentId = parsedBody.data.studentId;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return privateJson({ error: 'Corps trop volumineux' }, { status: 413 });
    // No/invalid JSON body: studentId stays undefined and is rejected below.
  }

  if (!studentId) {
    return privateJson(
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
      return privateJson({ error: 'Réservation introuvable' }, { status: 404 });
    }
    if (reservation.richStatus === 'CONFIRMED') {
      return privateJson({ error: 'Déjà confirmée' }, { status: 409 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!student) {
      return privateJson(
        { error: 'STUDENT_NOT_FOUND', message: 'Aucun élève ne correspond à cet identifiant.' },
        { status: 404 },
      );
    }

    const contact = z.string().email().safeParse(hasUserEmail(student.user.email) ? normalizeUserEmail(student.user.email) : null);
    const storedEmail = student.user.email;
    if (!contact.success || !hasUserEmail(storedEmail)) {
      return privateJson({ error: 'STUDENT_CONTACT_REQUIRED', message: "Le contact canonique de l’élève doit être renseigné avant confirmation." }, { status: 409 });
    }
    const deliveryEmail = contact.data;
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
        where: {
          id: reservation.id,
          // `richStatus` est nullable sans défaut BDD : en logique SQL à
          // trois valeurs, `richStatus <> 'CONFIRMED'` vaut NULL (pas TRUE)
          // quand la colonne est NULL, donc `updateMany` ne matcherait
          // jamais une réservation jamais initialisée. NULL est "pas encore
          // confirmée" au même titre que tout statut différent de CONFIRMED.
          OR: [{ richStatus: null }, { richStatus: { not: 'CONFIRMED' } }],
        },
        data: {
          richStatus: 'CONFIRMED',
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          studentId: student.id,
          ...(token ? { activationToken: token.tokenHash, activationTokenExpiresAt: token.expiresAt } : {}),
        },
      });
      if (updated.count !== 1) {
        alreadyConfirmed = true;
        return;
      }

      if (token) {
        await tx.user.update({
          where: { id: student.userId, email: storedEmail, activatedAt: null },
          data: { activationToken: token.tokenHash, activationExpiry: token.expiresAt },
        });
      }

      await enqueueEmailIntent(tx, {
        aggregateType: 'STAGE_RESERVATION',
        aggregateId: reservation.id,
        messageType: 'STUDENT_ACTIVATION',
        dedupeKey: token ? token.tokenHash : `stage-confirm:${reservation.id}`,
        to: deliveryEmail,
        subject: `✅ Inscription confirmée — ${stageTitle.replace(/[\r\n]/g, ' ')}`,
        html: activationUrl
          ? `<p>Bonjour ${escapeHtml(firstName)},</p>
             <p>Votre inscription au <strong>${escapeHtml(stageTitle)}</strong> est <strong>confirmée</strong>.</p>
             <p>Créez votre compte Nexus Réussite pour accéder à votre emploi du temps,
             vos ressources et votre bilan :</p>
             <p><a href="${escapeHtml(activationUrl)}" style="background:#4f46e5;color:white;padding:12px 24px;
             border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">
             Activer mon compte</a></p>
             <p style="color:#6b7280;font-size:14px;">Ce lien est valable 72 heures.</p>`
          : `<p>Bonjour ${escapeHtml(firstName)},</p>
             <p>Votre inscription au <strong>${escapeHtml(stageTitle)}</strong> est <strong>confirmée</strong>.</p>`,
      });
    });

    if (alreadyConfirmed) {
      return privateJson({ error: 'Déjà confirmée' }, { status: 409 });
    }

    kickEmailOutboxDrain();

    return privateJson({
      success: true,
      message: needsActivation
        ? "Réservation confirmée et email d'activation placé en file."
        : 'Réservation confirmée.',
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return privateJson({ error: 'STUDENT_CONTACT_CHANGED', message: "Les informations de l’élève ont changé ; recommencez la confirmation." }, { status: 409 });
    }
    console.error('[POST confirm reservation]', { code: 'STAGE_CONFIRMATION_FAILED' });
    return privateJson({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

function privateResponse(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(privateStageReadHeaders)) response.headers.set(name, value);
  return response;
}

function privateJson(body: unknown, init?: ResponseInit): NextResponse {
  return privateResponse(NextResponse.json(body, init));
}

export async function POST(req: NextRequest, context: { params: Promise<{ stageSlug: string; reservationId: string }> }): Promise<NextResponse> {
  try {
    return await confirmReservation(req, context);
  } catch {
    return privateJson({ error: 'Confirmation indisponible.' }, { status: 503 });
  }
}
