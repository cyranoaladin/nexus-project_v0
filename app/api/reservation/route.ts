import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { canAcceptPreRentreeCampaignSubmission } from '@/lib/campaigns/pre-rentree-2026/release-gate';
import { checkBodySize,checkCsrf } from '@/lib/csrf';
import { sendStageBankTransferConfirmation } from '@/lib/email';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { internalNotification } from '@/lib/email/templates';
import { LEGAL } from '@/lib/legal';
import { prisma } from '@/lib/prisma';
import { getActiveStageEndDateFilter } from '@/lib/stages/lifecycle';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { stageReservationSchema } from '@/lib/validations';
import { NextRequest,NextResponse } from 'next/server';

function getInternalNotificationRecipient(): string {
  return (
    process.env.INTERNAL_NOTIFICATION_EMAIL ||
    process.env.MAIL_REPLY_TO ||
    process.env.EMAIL_REPLY_TO ||
    LEGAL.contact.email
  );
}

/**
 * POST /api/reservation
 *
 * Pipeline: Rate limit → Honeypot → Zod validate → Server catalog → Create-only DB → Email
 * Returns: uniform 201 acknowledgement | 400 | 404 | 429 | 500; never grants update authority
 */
async function submitReservation(request: NextRequest) {
  try {
    // 0a. CSRF protection
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return csrfResponse;

    // 0b. Body size limit (1MB)
    const bodySizeResponse = checkBodySize(request);
    if (bodySizeResponse) return bodySizeResponse;

    // 1. Rate Limiting
    const blocked = await guardSensitiveRateLimit(request, {
      scope: 'reservation-submit',
      dimensions: ['ip'],
    });
    if (blocked) return blocked;

    let body: unknown;
    try {
      body = JSON.parse(await readBoundedRequestBody(request, 4096));
    } catch (error) {
      return NextResponse.json({ success: false, error: 'Corps de requête invalide' },
        { status: error instanceof RequestBodyTooLargeError ? 413 : 400 });
    }

    // 2. Honeypot check (bot trap field)
    if (typeof body === 'object' && body !== null &&
      (('website' in body && body.website) || ('url' in body && body.url) || ('honeypot' in body && body.honeypot))) {
      return reservationAcknowledgement();
    }

    // 3. Strict Zod validation
    const parseResult = stageReservationSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return NextResponse.json(
        {
          success: false,
          error: 'Données invalides',
          field: firstError?.path?.join('.') || 'unknown',
          message: firstError?.message || 'Validation échouée',
        },
        { status: 400 }
      );
    }

    if (parseResult.data.academyId === 'pre-rentree-2026' && !canAcceptPreRentreeCampaignSubmission()) {
      return NextResponse.json({ success: false, error: 'Stage introuvable ou inscriptions fermées' }, { status: 404 });
    }
    const stage = await prisma.stage.findUnique({
      where: { slug: parseResult.data.academyId, isVisible: true, isOpen: true,
        endDate: getActiveStageEndDateFilter(new Date()) },
      select: { id: true, slug: true, title: true, priceAmount: true },
    });
    if (!stage) return NextResponse.json({ success: false, error: 'Stage introuvable ou inscriptions fermées' }, { status: 404 });
    const data = { ...parseResult.data, email: normalizeUserEmail(parseResult.data.email),
      academyId: stage.slug, academyTitle: stage.title, price: Number(stage.priceAmount) };

    const identityBlocked = await guardSensitiveRateLimit(request, {
      scope: 'reservation-submit',
      identity: data.email,
      resource: data.academyId,
      dimensions: ['identity', 'resource'],
    });
    if (identityBlocked) return identityBlocked;

    // A public email string grants no authority to modify an existing record.
    const existing = await prisma.stageReservation.findUnique({
      where: { email_academyId: { email: data.email, academyId: data.academyId } },
      select: { id: true },
    });
    if (existing) return reservationAcknowledgement();
    const isBankTransfer = data.paymentMethod === 'bank_transfer';
    let reservationId: string;
    try {
      const created = await prisma.stageReservation.create({
      data: {
        stageId: stage.id, parentName: data.parent, studentName: data.studentName || null,
        email: data.email, phone: data.phone, classe: data.classe,
        academyId: stage.slug, academyTitle: stage.title, price: data.price,
        paymentMethod: data.paymentMethod || null,
        status: isBankTransfer ? 'PENDING_BANK_TRANSFER' : 'PENDING',
      },
      select: { id: true },
      });
      reservationId = created.id;
    } catch (error) {
      // Only the create operation can be acknowledged as a duplicate. Errors
      // in later notification work must not be mistaken for a reservation retry.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        return reservationAcknowledgement();
      }
      throw error;
    }


    // 4. Internal staff alert — non-blocking
    try {
      const tag = 'Nouveau lead chaud (site web)';
      const internalTemplate = internalNotification({
        eventType: tag,
        fields: {
          Parent: data.parent,
          Téléphone: data.phone,
          Email: data.email,
          Classe: data.classe,
          Intérêt: data.academyTitle,
          Montant: `${data.price} TND`,
          ...(data.paymentMethod === 'bank_transfer'
            ? { Paiement: 'Virement bancaire (en attente de vérification)' }
            : {}),
        },
      });
      await enqueueEmailIntent(prisma, {
        aggregateType: 'STAGE_RESERVATION',
        aggregateId: reservationId,
        messageType: 'TRANSACTIONAL_NOTIFICATION',
        dedupeKey: `reservation-internal:${reservationId}:${Date.now()}`,
        to: getInternalNotificationRecipient(),
        subject: internalTemplate.subject,
        html: internalTemplate.html,
        text: internalTemplate.text,
      });
      kickEmailOutboxDrain();
    } catch {
      console.error('[reservation]', { code: 'RESERVATION_INTERNAL_ALERT_FAILED' });
    }

    // 5. Email notification — non-blocking
    {
      try {
        if (data.paymentMethod === 'bank_transfer') {
          // Bank transfer confirmation email
          await sendStageBankTransferConfirmation(
            data.email,
            data.parent,
            data.studentName || null,
            data.academyTitle,
            data.price
          );
        }
      } catch {
        // Non-blocking: log but don't fail the request
        console.error('[reservation]', { code: 'RESERVATION_EMAIL_FAILED' });
      }
    }

    return reservationAcknowledgement();
  } catch {
    console.error('[reservation]', { code: 'RESERVATION_CREATE_FAILED' });
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reservation
 *
 * Staff-only: list all reservations (for admin dashboard).
 * RBAC: ADMIN or ASSISTANTE only
 */
export async function GET(request: NextRequest) {
  try {
    // RBAC Guard: Check session and role
    const session = await auth();
    const userRole = session?.user?.role;
    
    if (!session || (userRole !== 'ADMIN' && userRole !== 'ASSISTANTE')) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé. Rôle ADMIN ou ASSISTANTE requis.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const academyId = searchParams.get('academyId');

    const where: Record<string, string> = {};
    if (status) where.status = status;
    if (academyId) where.academyId = academyId;

    const reservations = await prisma.stageReservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        parentName: true,
        studentName: true,
        email: true,
        phone: true,
        classe: true,
        academyId: true,
        academyTitle: true,
        price: true,
        paymentMethod: true,
        status: true,
        scoringResult: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: reservations.length,
      reservations,
    });
  } catch (error) {
    console.error('[reservation] GET error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reservation
 *
 * Staff-only: validate or reject a bank transfer reservation.
 * Body: { reservationId, action: 'approve' | 'reject', note? }
 * - approve → sets status to CONFIRMED
 * - reject  → sets status to CANCELLED
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const userRole = session?.user?.role;

    if (!session || (userRole !== 'ADMIN' && userRole !== 'ASSISTANTE')) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reservationId, action } = body as {
      reservationId?: string;
      action?: 'approve' | 'reject';
      note?: string;
    };

    if (!reservationId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Paramètres invalides. Requis: reservationId, action (approve|reject).' },
        { status: 400 }
      );
    }

    const reservation = await prisma.stageReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: 'Réservation non trouvée.' },
        { status: 404 }
      );
    }

    if (reservation.status !== 'PENDING_BANK_TRANSFER' && reservation.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `Réservation déjà traitée (statut: ${reservation.status}).` },
        { status: 409 }
      );
    }

    const newStatus = action === 'approve' ? 'CONFIRMED' : 'CANCELLED';

    await prisma.stageReservation.update({
      where: { id: reservationId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: action === 'approve'
        ? 'Réservation validée — formule activée.'
        : 'Réservation rejetée.',
      newStatus,
    });
  } catch (error) {
    console.error('[reservation] PATCH error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

function reservationAcknowledgement(): NextResponse {
  return NextResponse.json({ success: true, message: 'Demande reçue. Notre équipe vous contactera pour la suite.' },
    { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = await submitReservation(request);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  return response;
}
