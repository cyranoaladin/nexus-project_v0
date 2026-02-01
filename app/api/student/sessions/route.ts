import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { createLogger } from '@/lib/middleware/logger';
import { successResponse, handleApiError } from '@/lib/api/errors';
import { UserRole } from '@/types/enums';

/**
 * GET /api/student/sessions - Get all sessions for authenticated student
 */
export async function GET(request: NextRequest) {
  let logger = createLogger(request);

  try {
    // Rate limiting
    const rateLimitResult = RateLimitPresets.api(request, 'student-sessions');
    if (rateLimitResult) return rateLimitResult;

    // Require ELEVE role
    const session = await requireRole(UserRole.ELEVE);
    if (isErrorResponse(session)) return session;

    // Update logger with session context
    logger = createLogger(request, session);
    logger.info('Fetching student sessions');

    const studentId = session.user.id;

    // Fetch sessions
    const sessions = await prisma.sessionBooking.findMany({
      where: {
        studentId: studentId
      },
      orderBy: [
        { scheduledDate: 'desc' },
        { startTime: 'desc' }
      ],
      include: {
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Format response
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      title: session.title,
      subject: session.subject,
      status: session.status,
      scheduledAt: new Date(`${session.scheduledDate.toISOString().split('T')[0]}T${session.startTime}`),
      duration: session.duration,
      creditsUsed: session.creditsUsed,
      modality: session.modality,
      type: session.type,
      coach: session.coach
    }));

    logger.logRequest(200, { count: formattedSessions.length });

    return successResponse({ sessions: formattedSessions });

  } catch (error) {
    logger.error('Failed to fetch student sessions', error);
    logger.logRequest(500);
    return handleApiError(error, 'GET /api/student/sessions');
  }
}
