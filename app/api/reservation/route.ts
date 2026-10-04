import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';

import { can } from '@/lib/rbac/permissions';
import { declineLegacyStageLead, legacyStageDecisionSchema } from '@/lib/stages/decline-legacy-lead';
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
import { z } from 'zod';

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

const staffListSchema = z.object({
  status: z.enum(['PENDING', 'PENDING_BANK_TRANSFER', 'CONFIRMED', 'CANCELLED', 'PAID']).optional(),
  academyId: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

/** Staff financial lead list; role and permissions are checked before retrieval. */
async function listStaffReservations(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id || session.user.id.length > 128 ||
    !['ADMIN', 'ASSISTANTE'].includes(session.user.role) ||
    !can(session.user.role, 'READ', 'RESERVATION') || !can(session.user.role, 'READ', 'PAYMENT')) {
    return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
  }
  const search = new URL(request.url).searchParams;
  const seen = new Set<string>();
  for (const key of search.keys()) {
    if (seen.has(key)) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });
    seen.add(key);
  }
  const parsed = staffListSchema.safeParse(Object.fromEntries(search));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });
  const limited = await guardSensitiveRateLimit(request, { scope: 'reservation-list', identity: session.user.id });
  if (limited) return limited;
  const { status, academyId, page, limit } = parsed.data;
  const rows = await prisma.stageReservation.findMany({
    where: { ...(status ? { status } : {}), ...(academyId ? { academyId } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit + 1,
    select: { id: true, parentName: true, studentName: true, email: true, phone: true, classe: true,
      academyId: true, academyTitle: true, price: true, paymentMethod: true, status: true, createdAt: true },
  });
  const reservations = rows.slice(0, limit);
  return NextResponse.json({ success: true, count: reservations.length, reservations,
    page, limit, hasNext: rows.length > limit });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let response: NextResponse;
  try { response = await listStaffReservations(request); }
  catch { response = NextResponse.json({ success: false, error: 'Liste indisponible.' }, { status: 503 }); }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  return response;
}

/**
 * PATCH /api/reservation
 *
 * Staff-only: decline an unlinked lead; financial approval requires its canonical workflow.
 * Body: { reservationId, action: 'approve' | 'reject', requestId: UUID }
 * - approve → fails closed; never claims activation or settlement
 * - reject → CAS + append-only audit only for an unlinked, uncommitted lead
 */

async function decideLegacyReservation(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id || session.user.id.length > 128 ||
    !can(session.user.role, 'UPDATE', 'RESERVATION')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (checkCsrf(request)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  let raw: unknown;
  try { raw = JSON.parse(await readBoundedRequestBody(request, 2048)); }
  catch (error) { return NextResponse.json({ error: 'Corps de requête invalide' },
    { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }); }
  const parsed = legacyStageDecisionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  const { reservationId, requestId, action } = parsed.data;
  if (action === 'approve') {
    if (!can(session.user.role, 'VALIDATE', 'PAYMENT')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    // This legacy lead endpoint cannot activate a pupil or reconcile a bank transfer.
    return NextResponse.json({ error: 'CANONICAL_CONFIRMATION_REQUIRED',
      message: 'Utilisez le parcours de confirmation lié à un élève ou le rapprochement financier.' }, { status: 409 });
  }
  const limited = await guardSensitiveRateLimit(request, { scope: 'reservation-decision',
    identity: session.user.id, resource: reservationId });
  if (limited) return limited;
  const result = await declineLegacyStageLead({ actorUserId: session.user.id, reservationId, requestId });
  if (result === 'DECLINED') return NextResponse.json({ success: true, message: 'Demande déclinée.', newStatus: 'CANCELLED' });
  return NextResponse.json({ error: result }, { status: result === 'NOT_FOUND' ? 404 : 409 });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  let response: NextResponse;
  try { response = await decideLegacyReservation(request); }
  catch { response = NextResponse.json({ error: 'Décision indisponible.' }, { status: 503 }); }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  return response;
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
