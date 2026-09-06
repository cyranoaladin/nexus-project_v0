import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { SessionStatus } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { cancelSessionSchema } from '@/lib/validation';
import { safeJsonParse, assertExists } from '@/lib/api/helpers';
import { successResponse, handleApiError, ApiError } from '@/lib/api/errors';
import { createLogger } from '@/lib/middleware/logger';
import { UserRole } from '@/types/enums';

/**
 * POST /api/sessions/cancel - Cancel a session booking
 *
 * Ownership, role and completed-session restrictions are enforced below.
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

    // Check if session can be cancelled
    if (sessionToCancel.status === SessionStatus.CANCELLED) {
      throw ApiError.badRequest('Session is already cancelled');
    }

    if (sessionToCancel.status === SessionStatus.COMPLETED) {
      throw ApiError.badRequest('Cannot cancel a completed session');
    }

    // Cancel the session
    await prisma.sessionBooking.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.CANCELLED,
        cancelledAt: new Date(),
        coachNotes: reason ? `Cancelled: ${reason}` : 'Cancelled'
      }
    });

    logger.logRequest(200, { sessionId });
    return successResponse({ success: true, message: 'Session annulée' });

  } catch (error) {
    const response = await handleApiError(error, 'POST /api/sessions/cancel');
    logger.logRequest(response.status);
    return response;
  }
}
