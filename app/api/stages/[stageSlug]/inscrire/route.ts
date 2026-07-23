export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import { telegramSendMessage } from '@/lib/telegram/client';
import { computeReservationStatus } from '@/lib/stages/capacity';
import { publicStageInscriptionSchema } from '@/lib/stages/inscription-schema';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { z } from 'zod';
import { getPreRentreeReleaseGate } from '@/lib/campaigns/pre-rentree-2026/release-gate';

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
  if (stageSlug === 'pre-rentree-2026' && !getPreRentreeReleaseGate().isPublicReady) {
    return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
  }

  const blocked = await guardRateLimitAsync(req, { preset: 'api', keySuffix: `stage-inscrire:${stageSlug}` });
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

  try {
    const stage = await prisma.stage.findUnique({
      where: { slug: stageSlug, isVisible: true, isOpen: true },
    });
    if (!stage) {
      return NextResponse.json(
        { error: 'Stage introuvable ou inscriptions fermées' },
        { status: 404 }
      );
    }

    const existing = await prisma.stageReservation.findFirst({
      where: { stageId: stage.id, email },
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
      parentEmail ? `Email parent: ${parentEmail}` : null,
      parentPhone ? `Téléphone parent: ${parentPhone}` : null,
      stageTermsAccepted ? 'Modalités stage acceptées: oui' : null,
      dataProcessingAccepted ? 'Consentement données: oui' : null,
    ].filter(Boolean).join('\n');

    await prisma.stageReservation.create({
      data: {
        stageId: stage.id,
        email,
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

    const statusLabel = richStatus === 'WAITLISTED' ? "Liste d'attente" : 'En attente de confirmation';

    await sendMail({
      to: email,
      subject: `Inscription reçue — ${stage.title}`,
      html: `<p>Bonjour ${firstName},</p>
             <p>Votre inscription au <strong>${stage.title}</strong> a bien été reçue.</p>
             <p>Statut : <strong>${statusLabel}</strong>.</p>
             <p>Notre équipe vous contactera dans les 24h pour les détails de paiement.</p>
             <p>L'équipe Nexus Réussite</p>`,
    });

    await telegramSendMessage(
      undefined,
      `📚 Nouvelle inscription stage\n*${stage.title}*\n${firstName} ${lastName} (${email})\nStatut: ${richStatus}`
    ).catch(() => {});

    return NextResponse.json(
      { reservation: { status: richStatus }, message: 'Inscription enregistrée.' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/stages/[slug]/inscrire]', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
