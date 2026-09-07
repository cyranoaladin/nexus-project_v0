import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { createLogger } from '@/lib/middleware/logger';
import { successResponse, handleApiError } from '@/lib/api/errors';
import { combineDateAndTime } from '@/lib/planning/invariants';
import { UserRole } from '@/types/enums';

/**
 * GET /api/student/sessions - Get all sessions for authenticated student
 *
 * Filtre par `studentProfileId` (identité canonique `Student.id`, Tâche 13),
 * jamais par l'ancien `studentId` (`User.id`) — même pattern de résolution
 * "propre Student.id de l'appelant" que `app/api/student/assignments/route.ts`.
 */
export async function GET(request: NextRequest) {
  let logger = createLogger(request);

  try {
    // Rate limiting
    const rateLimitResult = await guardSensitiveRateLimit(request, {
      scope: 'student-sessions',
      dimensions: ['ip'],
    });
    if (rateLimitResult) return rateLimitResult;

    // Require ELEVE role
    const session = await requireRole(UserRole.ELEVE);
    if (isErrorResponse(session)) return session;

    const identityBlocked = await guardSensitiveRateLimit(request, {
      scope: 'student-sessions',
      identity: session.user.id,
      dimensions: ['identity'],
    });
    if (identityBlocked) return identityBlocked;

    // Update logger with session context
    logger = createLogger(request, session);
    logger.info('Fetching student sessions');

    // Résolution de l'identité canonique de l'appelant — jamais son
    // `User.id` legacy — même pattern que GET /api/student/assignments.
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      logger.logRequest(404);
      return successResponse({ sessions: [] });
    }

    // Fetch sessions — filtrées par studentProfileId (Tâche 13), plus par
    // l'ancien champ studentId (User.id).
    const sessions = await prisma.sessionBooking.findMany({
      where: {
        studentProfileId: student.id
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
      scheduledAt: combineDateAndTime(session.scheduledDate, session.startTime),
      duration: session.duration,
      modality: session.modality,
      type: session.type,
      coach: session.coach
    }));

    logger.logRequest(200, { count: formattedSessions.length });

    return successResponse({ sessions: formattedSessions });

  } catch (error) {
    logger.error('Failed to fetch student sessions', error);
    logger.logRequest(500);
    return await handleApiError(error, 'GET /api/student/sessions');
  }
}
