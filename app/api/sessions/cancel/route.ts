import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { Prisma, SessionStatus } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { cancelSessionSchema } from '@/lib/validation';
import { safeJsonParse, assertExists } from '@/lib/api/helpers';
import { successResponse, handleApiError, ApiError } from '@/lib/api/errors';
import { createLogger } from '@/lib/middleware/logger';
import { UserRole } from '@/types/enums';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/**
 * POST /api/sessions/cancel - Cancel a session booking
 *
 * Ownership, role and completed-session restrictions are enforced below.
 * Cancels the booking without changing historical balances or promising a refund.
 *
 * Tâche 11 (docs/superpowers/plans/2026-09-06-core-family-academic-planning.md) :
 * décision explicite — cette route n'a PAS besoin de connaître
 * `SessionBooking.planningSeriesId`. Elle continue à annuler UNE occurrence
 * précise par son `id`, que cette occurrence appartienne ou non à une
 * `PlanningSeries` : c'est un cas d'usage légitime en soi (ex. un élève
 * annule une seule séance à venir d'une série qui continue par ailleurs), et
 * le contrôle atomique du statut et des participants préserve
 * l'invariant « les occurrences passées restent immuables » pour une
 * réservation individuelle. L'annulation FUTURE-ONLY *en masse* d'une série
 * entière est une opération distincte, exposée par
 * `DELETE /api/assistante/planning/series/[seriesId]`
 * (app/api/assistante/planning/series/[seriesId]/route.ts) — jamais dupliquée
 * ici. La protection contre les écritures concurrentes est assurée dans cette
 * route pour la Tâche 11.
 */
export async function POST(request: NextRequest) {
  let logger = createLogger(request);

  try {
    // Rate limiting (stricter for write operations)
    const rateLimitResult = await guardSensitiveRateLimit(request, {
      scope: 'session-cancel',
      dimensions: ['ip'],
    });
    if (rateLimitResult) return rateLimitResult;

    // Require ELEVE, COACH, or ASSISTANTE role
    const session = await requireAnyRole([UserRole.ELEVE, UserRole.COACH, UserRole.ASSISTANTE]);
    if (isErrorResponse(session)) return session;

    const identityBlocked = await guardSensitiveRateLimit(request, {
      scope: 'session-cancel',
      identity: session.user.id,
      dimensions: ['identity'],
    });
    if (identityBlocked) return identityBlocked;

    // Update logger with session context
    logger = createLogger(request, session);
    logger.info('Cancelling session');

    // Parse and validate request body
    const parsedBody = cancelSessionSchema.strict().safeParse(await safeJsonParse(request));
    if (!parsedBody.success) {
      throw ApiError.badRequest('Validation failed');
    }
    const { sessionId, reason } = parsedBody.data;
    const encodedCommand = request.headers.get('Idempotency-Key');
    const command = encodedCommand === null ? randomUUID() : z.string().uuid().safeParse(encodedCommand);
    if (typeof command !== 'string' && !command.success) throw ApiError.badRequest('Invalid cancellation command');
    const commandId = (typeof command === 'string' ? command : command.data).toLowerCase();
    const requestKey = `booking-cancel:v1:${session.user.id}:${commandId}`;

    // Fetch session
    const sessionToCancel = await prisma.sessionBooking.findUnique({
      where: { id: sessionId }
    });

    assertExists(sessionToCancel, 'Session');

    // Check permissions
    if (session.user.role === 'ELEVE') {
      if (session.user.id !== sessionToCancel.studentId) {
        throw ApiError.forbidden('You do not have permission to cancel this session');
      }
    }

    if (session.user.role === 'COACH') {
      if (session.user.id !== sessionToCancel.coachId) {
        throw ApiError.forbidden('You do not have permission to cancel this session');
      }
    }

    await prisma.$transaction(async tx => {
      const matchesCommand = (event: { sessionBookingId: string; actorUserId: string; reason: string; action: string }) => event.sessionBookingId === sessionId && event.actorUserId === session.user.id && event.reason === reason && event.action === 'BOOKING_CANCELLED';
      const prior = await tx.sessionBookingCancellationAudit.findUnique({ where: { requestKey } });
      if (prior) {
        if (!matchesCommand(prior)) throw ApiError.conflict('Cancellation command has different parameters');
        return;
      }

      // Check if session can be cancelled
      if (sessionToCancel.status === SessionStatus.CANCELLED) {
        throw ApiError.badRequest('Session is already cancelled');
      }

      if (sessionToCancel.status === SessionStatus.COMPLETED) {
        throw ApiError.badRequest('Cannot cancel a completed session');
      }

      if (!([SessionStatus.SCHEDULED, SessionStatus.CONFIRMED, SessionStatus.IN_PROGRESS] as SessionStatus[]).includes(sessionToCancel.status)) {
        throw ApiError.badRequest('Cannot cancel a historical session');
      }

      // Recheck status and participant ownership at the atomic SQL write.
      const cancelled = await tx.sessionBooking.updateMany({
        where: { id: sessionId, status: sessionToCancel.status, studentId: sessionToCancel.studentId, coachId: sessionToCancel.coachId },
        data: {
          status: SessionStatus.CANCELLED,
          cancelledAt: new Date(),
        }
      });

      if (cancelled.count !== 1) {
        const raced = await tx.sessionBookingCancellationAudit.findUnique({ where: { requestKey } });
        if (raced && matchesCommand(raced)) return;
        throw ApiError.conflict('Session changed; reload before cancelling.');
      }
      await tx.sessionBookingCancellationAudit.create({ data: {
        sessionBookingId: sessionId, actorUserId: session.user.id, actorRole: session.user.role,
        requestKey, action: 'BOOKING_CANCELLED', previousStatus: sessionToCancel.status,
        nextStatus: SessionStatus.CANCELLED, reason,
      } });
    }, { maxWait: 5_000, timeout: 20_000 });

    logger.logRequest(200, { sessionId });
    return successResponse({ success: true, message: 'Session annulée' });

  } catch (error) {
    const commandCollision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
      && error.meta?.modelName === 'SessionBookingCancellationAudit'
      && Array.isArray(error.meta.target) && error.meta.target.length === 1 && error.meta.target[0] === 'requestKey';
    const expectedError = commandCollision ? ApiError.conflict('Cancellation command has different parameters') : error instanceof ApiError ? error : null;
    if (!expectedError) logger.error('Session cancellation failed');
    const response = await handleApiError(expectedError ?? ApiError.internal('Session cancellation unavailable'), 'POST /api/sessions/cancel');
    logger.logRequest(response.status);
    return response;
  }
}
