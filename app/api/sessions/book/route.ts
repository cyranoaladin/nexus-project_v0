import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';

import { ApiError,errorResponse,handleZodError,HttpStatus,successResponse } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/helpers';
import { isErrorResponse,requireAnyRole } from '@/lib/guards';
import { createLogger } from '@/lib/middleware/logger';
import type { PlanningInvariantRequester } from '@/lib/planning/invariants';
import {
  PlanningCourseWithoutLegacySubjectError,
  PlanningInvariantViolationError,
  PlanningParticipantNotFoundError,
  PlanningTooManyOccurrencesError,
  invariantFailuresIncludeConflict,
  isPlanningConflictDatabaseError,
  materializePlanningSeries,
  parseCalendarDate,
} from '@/lib/planning/series';
import { prisma } from '@/lib/prisma';
import { parentStudentBookSessionSchema } from '@/lib/validation';
import { UserRole } from '@/types/enums';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { ZodError } from 'zod';

function normalizeTime(time: string): string {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const hh = String(isNaN(h) ? 0 : h).padStart(2, '0');
  const mm = String(isNaN(m) ? 0 : m).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * POST /api/sessions/book — réservation directe PARENT/ELEVE (Tâche 12).
 *
 * `studentId`/`coachId` sont des identités canoniques (`Student.id`/
 * `CoachProfile.id`) — jamais `User.id`. La création de la séance passe
 * intégralement par `materializePlanningSeries` (lib/planning/series.ts,
 * occurrence unique — `recurrenceCount: 1`, comme la planification staff de
 * la Tâche 11) : identité pédagogique, disponibilité effective et conflits
 * Élève/Coach/Stage viennent TOUS de la Tâche 10
 * (`lib/planning/invariants.ts`) — cette route ne réimplémente plus AUCUN de
 * ces contrôles. L'acteur PARENT/ELEVE n'a structurellement AUCUNE capacité
 * de dérogation (`PlanningInvariantRequester` role `PARENT_STUDENT`).
 *
 * Règles métier PROPRES à cette route (jamais déplacées vers les invariants
 * partagés, qui ne concernent QUE le planning) et préservées intégralement :
 *   - rattachement de l'élève à un foyer actif (household ownership) —
 *     vérifié AU PLUS PRÈS de l'écriture, à l'intérieur de la transaction,
 *     sans fenêtre entre le contrôle et l'écriture ;
 *   - un ELEVE ne peut réserver que pour lui-même ;
 *   - aucun crédit consommé (Amendement 11 — `creditsUsed: 0`, posé par
 *     `lib/planning/series.ts` sur CHAQUE occurrence, quel que soit ce qu'un
 *     appelant enverrait par ailleurs) ;
 *   - plafond de réservation à 3 mois, week-ends et horaires 8h-20h.
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  let logger = createLogger(req);

  try {
    // Rate limiting
    const rateLimitResult = await guardSensitiveRateLimit(req, {
      scope: 'session-book',
      dimensions: ['ip'],
    });
    if (rateLimitResult) return rateLimitResult;

    // Authentication & Authorization
    const session = await requireAnyRole([UserRole.PARENT, UserRole.ELEVE]);
    if (isErrorResponse(session)) return session;

    const identityBlocked = await guardSensitiveRateLimit(req, {
      scope: 'session-book',
      identity: session.user.id,
      dimensions: ['identity'],
    });
    if (identityBlocked) return identityBlocked;

    // Update logger with user context
    logger = createLogger(req, session);
    logger.info('Booking session');

    // Parse and validate input
    const validatedData = await parseBody(req, parentStudentBookSessionSchema);

    // Normalize times to HH:MM to ensure correct string comparisons in DB
    const requestStartTime = normalizeTime(validatedData.startTime);
    const requestEndTime = normalizeTime(validatedData.endTime);

    // Date calendaire ancrée UTC-minuit — même convention que
    // lib/planning/series.ts (Africa/Tunis à décalage fixe) — jamais une
    // Date locale au fuseau du serveur.
    let scheduledDate: Date;
    try {
      scheduledDate = parseCalendarDate(validatedData.scheduledDate);
    } catch {
      throw ApiError.badRequest('Invalid scheduledDate');
    }

    // Check if booking is too far in the future (max 3 months)
    const maxBookingDate = new Date();
    maxBookingDate.setMonth(maxBookingDate.getMonth() + 3);
    if (scheduledDate > maxBookingDate) {
      throw ApiError.badRequest('Cannot book sessions more than 3 months in advance');
    }

    // Check if booking is on a weekend (optional business rule)
    const dayOfWeek = scheduledDate.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw ApiError.badRequest('Sessions cannot be booked on weekends');
    }

    // Check if booking is outside business hours (8 AM to 8 PM)
    const startHour = parseInt(requestStartTime.split(':')[0]);
    const endHour = parseInt(requestEndTime.split(':')[0]);
    if (startHour < 8 || endHour > 20) {
      throw ApiError.badRequest('Sessions must be between 8:00 AM and 8:00 PM');
    }

    // PARENT/ELEVE n'a structurellement AUCUNE dérogation — pas de champ
    // `override` sur cette branche de `PlanningInvariantRequester`, jamais
    // même une possibilité de le transmettre depuis cette route.
    const requester: PlanningInvariantRequester = { role: 'PARENT_STUDENT', actorId: session.user.id };

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Le droit de réserver dépend du rattachement de l'élève à un foyer
      // (plus un solde de crédits) : vérifié ici, au plus près de la lecture
      // du dossier élève, sans fenêtre entre le contrôle et l'écriture.
      const studentRecord = await tx.student.findUnique({
        where: { id: validatedData.studentId },
        include: { user: true, parent: { include: { user: true } } },
      });
      if (!studentRecord) {
        throw ApiError.badRequest('Student not found');
      }
      if (session.user.role === 'ELEVE' && studentRecord.userId !== session.user.id) {
        throw ApiError.forbidden('You can only book sessions for your own account');
      }
      if (session.user.role === 'PARENT' && studentRecord.parent?.userId !== session.user.id) {
        throw ApiError.forbidden('You can only book sessions for your children');
      }
      if (studentRecord.user.mergedIntoUserId) {
        throw ApiError.forbidden('Ce compte élève a été remplacé par un autre.');
      }
      if (!studentRecord.parent || studentRecord.parent.user.mergedIntoUserId) {
        throw ApiError.forbidden("Cet élève n'est rattaché à aucun foyer actif.");
      }

      const materialization = await materializePlanningSeries(
        tx,
        {
          studentProfileId: validatedData.studentId,
          coachProfileId: validatedData.coachId,
          assignmentId: validatedData.assignmentId,
          academicCourseKey: validatedData.academicCourseKey,
          startDate: scheduledDate,
          localStartTime: requestStartTime,
          localEndTime: requestEndTime,
          durationMinutes: validatedData.duration,
          intervalWeeks: 1,
          // Toujours une occurrence unique — cette route ne supporte aucune
          // récurrence (contrairement à /api/assistante/sessions).
          count: 1,
          // `parseBody` (lib/api/helpers.ts) infère son type générique en
          // laissant `| undefined` sur les champs à `.default()` de Zod (leur
          // VALEUR est pourtant toujours posée à l'exécution par
          // `schema.parse()`) — filet de sécurité TypeScript, jamais
          // atteignable en pratique.
          modality: validatedData.modality ?? 'ONLINE',
          location: null,
          type: validatedData.type ?? 'INDIVIDUAL',
          title: validatedData.title,
          description: validatedData.description ?? null,
          createdById: session.user.id,
        },
        requester,
      );

      return { occurrence: materialization.occurrences[0]! };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000  // 15 seconds timeout for complex booking logic
    });

    // Recharge post-commit des données d'affichage (notifications, réponse) —
    // `materializePlanningSeries` ne renvoie que les identifiants/horaires,
    // jamais les relations complètes (hors de son périmètre : Tâche 11).
    const booking = await prisma.sessionBooking.findUnique({
      where: { id: result.occurrence.id },
      include: { student: true, coach: true, parent: true },
    });
    if (!booking) {
      // Inatteignable en pratique : matérialisée à l'instant, dans la
      // transaction qui vient de committer.
      throw new Error('Booking disappeared immediately after creation');
    }

    // =========================================================================
    // POST-COMMIT SIDE-EFFECTS (best-effort — never rollback the booking)
    // =========================================================================

    // Create notifications (post-commit, non-fatal)
    try {
      const notifications: Prisma.SessionNotificationCreateManyInput[] = [];

      notifications.push({
        sessionId: booking.id,
        userId: booking.coach.id,
        type: 'SESSION_BOOKED',
        title: 'Nouvelle session réservée',
        message: `${booking.student.firstName} ${booking.student.lastName} a réservé une session de ${validatedData.academicCourseKey} pour le ${scheduledDate.toLocaleDateString('fr-FR')} à ${validatedData.startTime}`,
        method: 'EMAIL'
      });

      const assistants = await prisma.user.findMany({
        where: { role: 'ASSISTANTE' }
      });

      for (const assistant of assistants) {
        notifications.push({
          sessionId: booking.id,
          userId: assistant.id,
          type: 'SESSION_BOOKED',
          title: 'Nouvelle session planifiée',
          message: `Session ${validatedData.academicCourseKey} entre ${booking.coach.firstName} ${booking.coach.lastName} et ${booking.student.firstName} ${booking.student.lastName} programmée pour le ${scheduledDate.toLocaleDateString('fr-FR')} à ${validatedData.startTime}`,
          method: 'IN_APP'
        });
      }

      if (booking.parentId && booking.parentId !== session.user.id) {
        notifications.push({
          sessionId: booking.id,
          userId: booking.parentId,
          type: 'SESSION_BOOKED',
          title: 'Session réservée pour votre enfant',
          message: `Session de ${validatedData.academicCourseKey} avec ${booking.coach.firstName} ${booking.coach.lastName} programmée pour ${booking.student.firstName} ${booking.student.lastName} le ${scheduledDate.toLocaleDateString('fr-FR')} à ${validatedData.startTime}`,
          method: 'EMAIL'
        });
      }

      await prisma.sessionNotification.createMany({ data: notifications, skipDuplicates: true });
    } catch (notifError) {
      logger.warn('Notification side-effect failed (non-fatal)', { requestId, error: notifError instanceof Error ? notifError.message : 'unknown' });
    }

    // Create reminders (post-commit, non-fatal)
    try {
      const reminders: Prisma.SessionReminderCreateManyInput[] = [];
      const sessionDateTime = new Date(`${validatedData.scheduledDate}T${validatedData.startTime}`);

      reminders.push({
        sessionId: booking.id,
        reminderType: 'ONE_DAY_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 24 * 60 * 60 * 1000)
      });
      reminders.push({
        sessionId: booking.id,
        reminderType: 'TWO_HOURS_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 2 * 60 * 60 * 1000)
      });
      reminders.push({
        sessionId: booking.id,
        reminderType: 'THIRTY_MINUTES_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 30 * 60 * 1000)
      });

      await prisma.sessionReminder.createMany({ data: reminders, skipDuplicates: true });
    } catch (reminderError) {
      logger.warn('Reminder side-effect failed (non-fatal)', { requestId, error: reminderError instanceof Error ? reminderError.message : 'unknown' });
    }

    logger.logRequest(HttpStatus.CREATED, {
      requestId,
      sessionId: booking.id,
      coachId: validatedData.coachId,
      studentId: validatedData.studentId,
      academicCourseKey: validatedData.academicCourseKey,
    });

    return successResponse({
      success: true,
      sessionId: booking.id,
      message: 'Session booked successfully',
      session: booking
    }, HttpStatus.CREATED);

  } catch (error) {
    // ApiError instances are business-logic errors — return them directly
    if (error instanceof ApiError) {
      logger.warn('Booking rejected', { requestId, code: error.code, message: error.message });
      return error.toResponse();
    }

    // Zod validation errors from parseBody — return 422
    if (error instanceof ZodError) {
      logger.warn('Booking validation failed', { requestId, validationErrors: error.errors.length });
      return handleZodError(error);
    }

    // Invariants de planning partagés (Tâche 10/11) — mêmes codes que
    // /api/assistante/sessions pour un contrat d'erreur cohérent.
    if (error instanceof PlanningTooManyOccurrencesError) {
      return errorResponse(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', error.message, { requestId });
    }
    if (error instanceof PlanningParticipantNotFoundError || error instanceof PlanningCourseWithoutLegacySubjectError) {
      return errorResponse(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', error.message, { requestId });
    }
    if (error instanceof PlanningInvariantViolationError) {
      const conflict = invariantFailuresIncludeConflict(error.failures);
      return errorResponse(
        conflict ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST,
        conflict ? 'BOOKING_CONFLICT' : 'VALIDATION_ERROR',
        error.failures.map((f) => f.message).join('; '),
        { requestId, failures: error.failures },
      );
    }

    // Prisma / DB constraint errors
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { code: string; meta?: Record<string, unknown> };
      const prismaCode = dbError.code;

      logger.error('Booking DB error', error instanceof Error ? error : undefined, {
        requestId,
        prismaCode,
        meta: dbError.meta,
      });

      if (prismaCode === '23P01') {
        return errorResponse(HttpStatus.CONFLICT, 'BOOKING_CONFLICT', 'Coach already has a session at this time.', { requestId });
      }
      if (prismaCode === 'P2002') {
        return errorResponse(HttpStatus.CONFLICT, 'BOOKING_DUPLICATE', 'This session has already been booked.', { requestId });
      }
      if (prismaCode === 'P2034') {
        return errorResponse(HttpStatus.CONFLICT, 'BOOKING_SERIALIZATION', 'Booking conflict detected. Please try again.', { requestId });
      }
    }
    if (isPlanningConflictDatabaseError(error)) {
      return errorResponse(HttpStatus.CONFLICT, 'BOOKING_CONFLICT', 'Coach already has a session at this time.', { requestId });
    }

    // Truly unexpected error — log full context for CI diagnostics
    logger.error('Booking unexpected error', error instanceof Error ? error : undefined, {
      requestId,
    });

    return errorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'BOOKING_FAILED',
      'Booking failed',
      { requestId }
    );
  }
}
