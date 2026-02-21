export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { SessionStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { sessionVideoSchema } from '@/lib/validation';
import { parseBody } from '@/lib/api/helpers';
import { successResponse, handleApiError, ApiError } from '@/lib/api/errors';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { createLogger } from '@/lib/middleware/logger';
import { UserRole } from '@/types/enums';

export async function POST(request: NextRequest) {
  let logger = createLogger(request);

  try {
    // Rate limiting (prevent spam video room creation)
    const rateLimitResult = RateLimitPresets.api(request, 'session-video');
    if (rateLimitResult) return rateLimitResult;

    // Authorization
    const session = await requireAnyRole([UserRole.ELEVE, UserRole.COACH, UserRole.PARENT]);
    if (isErrorResponse(session)) return session;

    // Update logger with session context
    logger = createLogger(request, session);
    logger.info('Processing video session action');

    // Validation
    const { sessionId, action } = await parseBody(request, sessionVideoSchema);

    // Vérifier que la session existe et que l'utilisateur y a accès (SessionBooking canonique)
    const bookingSession = await prisma.sessionBooking.findFirst({
      where: {
        id: sessionId,
        OR: [
          { studentId: session.user.id },
          { coachId: session.user.id },
          { parentId: session.user.id }
        ]
      },
      include: {
        student: true,
        coach: true,
        parent: true
      }
    });

    if (!bookingSession) {
      throw ApiError.notFound('Session not found or access denied');
    }

    // Vérifier que la session est accessible temporellement (±15 min autour du début)
    const now = new Date();
    const sessionStart = new Date(
      `${bookingSession.scheduledDate.toISOString().split('T')[0]}T${bookingSession.startTime}`
    );
    const fifteenMinutes = 15 * 60 * 1000;

    if (now.getTime() < sessionStart.getTime() - fifteenMinutes) {
      throw ApiError.badRequest('Session is not yet available. You can join 15 minutes before the scheduled time.');
    }

    switch (action) {
      case 'JOIN':
        // Marquer la session comme en cours si elle ne l'est pas déjà
        if (bookingSession.status === 'SCHEDULED') {
          await prisma.sessionBooking.update({
            where: { id: sessionId },
            data: { status: SessionStatus.IN_PROGRESS }
          });
        }

        // Générer les informations de la room Jitsi selon les directives CTO
        const uuid = crypto.randomUUID();
        const roomName = `nexus-reussite-session-${sessionId}-${uuid}`;
        const jitsiServerUrl = process.env.NEXT_PUBLIC_JITSI_SERVER_URL || 'https://meet.jit.si';
        const jitsiUrl = `${jitsiServerUrl}/${roomName}`;

        logger.logRequest(200, { sessionId, action: 'JOIN', roomName });
        
        return successResponse({
          success: true,
          sessionData: {
            id: bookingSession.id,
            roomName,
            jitsiUrl,
            studentName: `${bookingSession.student.firstName ?? ''} ${bookingSession.student.lastName ?? ''}`.trim(),
            coachName: `${bookingSession.coach.firstName ?? ''} ${bookingSession.coach.lastName ?? ''}`.trim(),
            subject: bookingSession.subject,
            scheduledAt: sessionStart,
            duration: bookingSession.duration,
            status: bookingSession.status,
            isHost: session.user.role === 'COACH'
          }
        });

      case 'LEAVE':
        // Only coach can mark session as completed
        if (session.user.role === 'COACH' && session.user.id === bookingSession.coachId) {
          await prisma.sessionBooking.update({
            where: { id: sessionId },
            data: { status: SessionStatus.COMPLETED, completedAt: new Date() }
          });
          
          logger.info('Session marked as completed by coach', { sessionId });
        } else {
          // For students/parents, just log the departure
          await prisma.sessionBooking.update({
            where: { id: sessionId },
            data: {
              coachNotes: `${session.user.firstName} ${session.user.lastName} left at ${new Date().toISOString()}`
            }
          });
          
          logger.info('Participant left session', { sessionId, userId: session.user.id });
        }

        logger.logRequest(200, { sessionId, action: 'LEAVE' });

        return successResponse({
          success: true,
          message: 'Session left successfully'
        });

      default:
        throw ApiError.badRequest('Unsupported action');
    }

  } catch (error) {
    logger.error('Video session error', error);
    logger.logRequest(500);
    return await handleApiError(error, 'POST /api/sessions/video');
  }
}
