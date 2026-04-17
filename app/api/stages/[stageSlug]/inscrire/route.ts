export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import { telegramSendMessage } from '@/lib/telegram/client';
import { computeReservationStatus } from '@/lib/stages/capacity';
import { publicStageInscriptionSchema } from '@/lib/stages/inscription-schema';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string }> }
) {
  const { stageSlug } = await params;

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
        { error: 'Une inscription existe déjà pour cet email sur ce stage.', reservationId: existing.id },
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
    ].filter(Boolean).join('\n');

    const reservation = await prisma.stageReservation.create({
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
      { reservation: { id: reservation.id, status: richStatus }, message: 'Inscription enregistrée.' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/stages/[slug]/inscrire]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
