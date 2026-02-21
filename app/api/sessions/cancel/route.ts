export const dynamic = 'force-dynamic';

import { refundSessionBookingById, canCancelBooking } from '@/lib/domain/credits';
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

    // Use the centralized cancellation policy function
    let canRefund = canCancelBooking(
      sessionToCancel.type,
      sessionToCancel.modality,
      sessionDate,
      now
    );

    // Assistantes can always override (for exceptional cases)
    if (session.user.role === 'ASSISTANTE') {
      canRefund = true;
    }
    
    const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Cancel session and refund credits atomically in single transaction
    await prisma.$transaction(async (tx) => {
      // 1. Cancel the session
      await tx.sessionBooking.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.CANCELLED,
          cancelledAt: new Date(),
          coachNotes: reason ? `Cancelled: ${reason}` : 'Cancelled'
        }
      });

      // 2. Refund credits if eligible (idempotent within transaction)
      if (canRefund) {
        // Find student entity
        const studentEntity = await tx.student.findFirst({
          where: { userId: sessionToCancel.studentId }
        });

        if (studentEntity) {
          // Check for existing REFUND transaction (idempotency)
          const existingRefund = await tx.creditTransaction.findFirst({
            where: { sessionId, type: 'REFUND' }
          });

          if (!existingRefund) {
            // Create refund transaction
            await tx.creditTransaction.create({
              data: {
                studentId: studentEntity.id,
                type: 'REFUND',
                amount: sessionToCancel.creditsUsed,
                description: reason ? `Refund: ${reason}` : 'Refund: cancellation',
                sessionId
              }
            });

            // Update cached credits field
            await tx.student.update({
              where: { id: studentEntity.id },
              data: { credits: { increment: sessionToCancel.creditsUsed } }
            });
          }
        }
      }
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000  // 10 seconds timeout
    });

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
    return await handleApiError(error, 'POST /api/sessions/cancel');
  }
}
