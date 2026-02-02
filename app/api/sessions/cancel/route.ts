export const dynamic = 'force-dynamic';

import { refundSessionBookingById } from '@/lib/credits';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { SessionStatus } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { cancelSessionSchema } from '@/lib/validation';
import { parseBody, assertExists } from '@/lib/api/helpers';
import { successResponse, handleApiError, ApiError } from '@/lib/api/errors';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { createLogger } from '@/lib/middleware/logger';
import { UserRole } from '@/types/enums';

/**
 * POST /api/sessions/cancel - Cancel a session booking
 *
 * Cancellation policy:
 * - Individual/Online/Hybrid: Must cancel 24h before
 * - Group/Masterclass: Must cancel 48h before
 * - Assistantes can always refund (exceptional cases)
 */
export async function POST(request: NextRequest) {
  let logger = createLogger(request);

  try {
    // Rate limiting (stricter for write operations)
    const rateLimitResult = RateLimitPresets.expensive(request, 'session-cancel');
    if (rateLimitResult) return rateLimitResult;

    // Require ELEVE, COACH, or ASSISTANTE role
    const session = await requireAnyRole([UserRole.ELEVE, UserRole.COACH, UserRole.ASSISTANTE]);
    if (isErrorResponse(session)) return session;

    // Update logger with session context
    logger = createLogger(request, session);
    logger.info('Cancelling session');

    // Parse and validate request body
    const { sessionId, reason } = await parseBody(request, cancelSessionSchema);

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

    // Check cancellation policy for refund eligibility
    const now = new Date();
    const sessionDate = new Date(
      `${sessionToCancel.scheduledDate.toISOString().split('T')[0]}T${sessionToCancel.startTime}`
    );
    const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let canRefund = false;

    // Cancellation policy based on session type
    if (
      sessionToCancel.type === 'INDIVIDUAL' ||
      sessionToCancel.modality === 'HYBRID' ||
      sessionToCancel.modality === 'ONLINE'
    ) {
      canRefund = hoursUntilSession >= 24; // 24h notice required
    } else if (
      sessionToCancel.type === 'GROUP' ||
      sessionToCancel.type === 'MASTERCLASS'
    ) {
      canRefund = hoursUntilSession >= 48; // 48h notice required
    }

    // Assistantes can always override (for exceptional cases)
    if (session.user.role === 'ASSISTANTE') {
      canRefund = true;
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

    // Refund credits if eligible (idempotent)
    if (canRefund) {
      await refundSessionBookingById(sessionId, reason);
    }

    logger.logRequest(200, {
      sessionId,
      refunded: canRefund,
      hoursUntilSession: Math.round(hoursUntilSession)
    });

    return successResponse({
      success: true,
      refunded: canRefund,
      message: canRefund
        ? 'Session cancelled and credits refunded'
        : 'Session cancelled (no refund - deadline passed)'
    });

  } catch (error) {
    logger.error('Failed to cancel session', error);
    logger.logRequest(500);
    return handleApiError(error, 'POST /api/sessions/cancel');
  }
}
