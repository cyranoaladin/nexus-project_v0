export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { internalNotification } from '@/lib/email/templates';
import { LEGAL } from '@/lib/legal';
import { computeReservationStatus } from '@/lib/stages/capacity';
import { publicStageInscriptionSchema } from '@/lib/stages/inscription-schema';
import { getActiveStageEndDateFilter } from '@/lib/stages/lifecycle';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { z } from 'zod';
import { canAcceptPreRentreeCampaignSubmission } from '@/lib/campaigns/pre-rentree-2026/release-gate';
import { normalizeUserEmail } from '@/lib/contact/user-email';

function getInternalNotificationRecipient(): string {
  return (
    process.env.INTERNAL_NOTIFICATION_EMAIL ||
    process.env.MAIL_REPLY_TO ||
    process.env.EMAIL_REPLY_TO ||
    LEGAL.contact.email
  );
}

const stageInscriptionParamsSchema = z.object({
  stageSlug: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]*$/),
}).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string }> }
) {
  const parsedParams = stageInscriptionParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Paramètres de stage invalides' }, { status: 400 });
  }
  const { stageSlug } = parsedParams.data;
  if (stageSlug === 'pre-rentree-2026' && !canAcceptPreRentreeCampaignSubmission()) {
    return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
  }

  const blocked = await guardSensitiveRateLimit(req, {
    scope: 'stage-registration',
    resource: stageSlug,
    dimensions: ['ip', 'resource'],
  });
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = publicStageInscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const identityBlocked = await guardSensitiveRateLimit(req, {
    scope: 'stage-registration',
    identity: parsed.data.parentEmail || parsed.data.email,
    dimensions: ['identity'],
  });
  if (identityBlocked) return identityBlocked;

  const {
    firstName,
    lastName,
    email,
    phone,
    level,
    parentFirstName,
    parentLastName,
    parentEmail,
    parentPhone,
    notes,
    stageTermsAccepted,
    dataProcessingAccepted,
  } = parsed.data;
  const normalizedEmail = normalizeUserEmail(email);
  const normalizedParentEmail = parentEmail ? normalizeUserEmail(parentEmail) : undefined;

  try {
    const now = new Date();
    const stage = await prisma.stage.findUnique({
      where: {
        slug: stageSlug,
        isVisible: true,
        isOpen: true,
        endDate: getActiveStageEndDateFilter(now),
      },
    });
    if (!stage) {
      return NextResponse.json(
        { error: 'Stage introuvable ou inscriptions fermées' },
        { status: 404 }
      );
    }

    const existing = await prisma.stageReservation.findFirst({
      where: { stageId: stage.id, email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Une inscription existe déjà pour cet email sur ce stage.' },
        { status: 409 }
      );
    }

    const confirmedCount = await prisma.stageReservation.count({
      where: {
        stageId: stage.id,
        richStatus: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    const richStatus = computeReservationStatus(confirmedCount, stage.capacity);

    const studentName = `${firstName} ${lastName}`.trim();
    const parentName = [parentFirstName, parentLastName].filter(Boolean).join(' ').trim() || studentName;
    const additionalNotes = [
      notes?.trim(),
      normalizedParentEmail ? `Email parent: ${normalizedParentEmail}` : null,
      parentPhone ? `Téléphone parent: ${parentPhone}` : null,
      stageTermsAccepted ? 'Modalités stage acceptées: oui' : null,
      dataProcessingAccepted ? 'Consentement données: oui' : null,
    ].filter(Boolean).join('\n');

    const statusLabel = richStatus === 'WAITLISTED' ? "Liste d'attente" : 'En attente de confirmation';
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.stageReservation.create({
        data: {
          stageId: stage.id,
          email: normalizedEmail,
          parentName,
          studentName,
          phone: phone?.trim() || parentPhone?.trim() || '',
          classe: level ?? '',
          academyId: stage.slug,
          academyTitle: stage.title,
          price: Number(stage.priceAmount),
          richStatus,
          notes: additionalNotes || null,
        },
      });
      await enqueueEmailIntent(tx, {
        aggregateType: 'STAGE_RESERVATION',
        aggregateId: reservation.id,
        messageType: 'TRANSACTIONAL_NOTIFICATION',
        dedupeKey: `registration:${reservation.id}`,
        to: normalizedEmail,
        subject: `Inscription reçue — ${stage.title}`,
        html: `<p>Bonjour ${firstName},</p>
             <p>Votre inscription au <strong>${stage.title}</strong> a bien été reçue.</p>
             <p>Statut : <strong>${statusLabel}</strong>.</p>
             <p>Notre équipe vous contactera dans les 24h pour les détails de paiement.</p>
             <p>L'équipe Nexus Réussite</p>`,
      });

      const internalTemplate = internalNotification({
        eventType: 'Nouvelle inscription stage',
        fields: {
          Stage: stage.title,
          Élève: `${firstName} ${lastName}`,
          Email: normalizedEmail,
          Statut: richStatus,
        },
      });
      await enqueueEmailIntent(tx, {
        aggregateType: 'STAGE_RESERVATION',
        aggregateId: reservation.id,
        messageType: 'TRANSACTIONAL_NOTIFICATION',
        dedupeKey: `registration-internal:${reservation.id}`,
        to: getInternalNotificationRecipient(),
        subject: internalTemplate.subject,
        html: internalTemplate.html,
        text: internalTemplate.text,
      });
    });
    kickEmailOutboxDrain();

    return NextResponse.json(
      { reservation: { status: richStatus }, message: 'Inscription enregistrée.' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/stages/[slug]/inscrire]', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
