export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, type CreditTransaction } from '@prisma/client';
import { bookFullSessionSchema } from '@/lib/validation';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { ApiError, successResponse, handleApiError, HttpStatus } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/helpers';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { createLogger } from '@/lib/middleware/logger';
import { UserRole } from '@/types/enums';
import { requireFeatureApi } from '@/lib/access';
import { parseSubjects } from '@/lib/utils/subjects';

function normalizeTime(time: string): string {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const hh = String(isNaN(h) ? 0 : h).padStart(2, '0');
  const mm = String(isNaN(m) ? 0 : m).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export async function POST(req: NextRequest) {
  let logger = createLogger(req);

  try {
    // Rate limiting
    const rateLimitResult = RateLimitPresets.expensive(req, 'session-book');
    if (rateLimitResult) return rateLimitResult;

    // Authentication & Authorization
    const session = await requireAnyRole([UserRole.PARENT, UserRole.ELEVE]);
    if (isErrorResponse(session)) return session;

    // Update logger with user context
    logger = createLogger(req, session);
    logger.info('Booking session');

    // Entitlement guard: check credits_use feature
    const denied = await requireFeatureApi('credits_use', { id: session.user.id, role: session.user.role });
    if (denied) return denied;

    // Parse and validate input
    const validatedData = await parseBody(req, bookFullSessionSchema);

    // Normalize times to HH:MM to ensure correct string comparisons in DB
    const requestStartTime = normalizeTime(validatedData.startTime);
    const requestEndTime = normalizeTime(validatedData.endTime);

    // Additional business logic validation
    const scheduledDate = parseLocalDate(validatedData.scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if booking is too far in the future (max 3 months)
    const maxBookingDate = new Date();
    maxBookingDate.setMonth(maxBookingDate.getMonth() + 3);
    if (scheduledDate > maxBookingDate) {
      throw ApiError.badRequest('Cannot book sessions more than 3 months in advance');
    }

    // Check if booking is on a weekend (optional business rule)
    const dayOfWeek = scheduledDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw ApiError.badRequest('Sessions cannot be booked on weekends');
    }

    // Check if booking is outside business hours (8 AM to 8 PM)
    const startHour = parseInt(requestStartTime.split(':')[0]);
    const endHour = parseInt(requestEndTime.split(':')[0]);
    if (startHour < 8 || endHour > 20) {
      throw ApiError.badRequest('Sessions must be between 8:00 AM and 8:00 PM');
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Validate coach exists and teaches the subject
      const coachProfile = await tx.coachProfile.findFirst({
        where: {
          userId: validatedData.coachId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      });

      if (!coachProfile || coachProfile.user.role !== 'COACH') {
        throw new Error('Coach not found or does not teach this subject');
      }

      // Validate subject match (Json field — may be array or string-encoded array)
      const coachSubjects = parseSubjects(coachProfile.subjects);
      if (!coachSubjects.includes(validatedData.subject)) {
        throw new Error('Coach not found or does not teach this subject');
      }

      // 2. Validate student exists
      const student = await tx.user.findFirst({
        where: {
          id: validatedData.studentId,
          role: 'ELEVE'
        }
      });

      if (!student) {
        throw new Error('Student not found');
      }

      // 3. Get parent ID if current user is parent
      let parentId = null;
      if (session.user.role === 'PARENT') {
        parentId = session.user.id;
        
        // Verify parent-student relationship
        const parentProfile = await tx.parentProfile.findFirst({
          where: { userId: parentId }
        });

        if (!parentProfile) {
          throw new Error('Parent profile not found');
        }

        // Check if student is in parent's children list (via Student relation)
        const studentExists = await tx.student.findFirst({
          where: { 
            userId: validatedData.studentId,
            parentId: parentProfile.id
          }
        });

        if (!studentExists) {
          throw new Error('You can only book sessions for your children');
        }
      }

      // 4. Enhanced coach availability check
      const dayStart = new Date(scheduledDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(scheduledDate);
      dayEnd.setHours(23, 59, 59, 999);

      const availability = await tx.coachAvailability.findFirst({
        where: {
          coachId: validatedData.coachId,
          OR: [
            {
              // Regular weekly availability (no validFrom/validUntil constraints to avoid edge TZ issues)
              dayOfWeek: dayOfWeek,
              isRecurring: true,
              isAvailable: true,
              startTime: { lte: requestStartTime },
              endTime: { gte: requestEndTime },
            },
            {
              // Specific date availability (use day range)
              isRecurring: false,
              specificDate: {
                gte: dayStart,
                lte: dayEnd
              },
              isAvailable: true,
              startTime: { lte: requestStartTime },
              endTime: { gte: requestEndTime }
            }
          ]
        }
      });

      if (!availability) {
        throw new Error('Coach is not available at the requested time');
      }

      // 5. Enhanced conflict checking
      const conflictingSession = await tx.sessionBooking.findFirst({
        where: {
          coachId: validatedData.coachId,
          scheduledDate: scheduledDate,
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
          OR: [
            {
              // New session starts during existing session
              AND: [
                { startTime: { lte: requestStartTime } },
                { endTime: { gt: requestStartTime } }
              ]
            },
            {
              // New session ends during existing session
              AND: [
                { startTime: { lt: requestEndTime } },
                { endTime: { gte: requestEndTime } }
              ]
            },
            {
              // New session completely contains existing session
              AND: [
                { startTime: { gte: requestStartTime } },
                { endTime: { lte: requestEndTime } }
              ]
            }
          ]
        }
      });

      if (conflictingSession) {
        throw new Error('Coach already has a session at this time');
      }

      // 6. Check student credits with enhanced validation
      const studentRecord = await tx.student.findFirst({
        where: { userId: validatedData.studentId }
      });

      if (!studentRecord) {
        throw new Error('Student not found');
      }

      // Calculate current credits from transactions
      const creditTransactions = await tx.creditTransaction.findMany({
        where: { studentId: studentRecord.id }
      });

      const currentCredits = creditTransactions.reduce((total: number, transaction: CreditTransaction) => {
        return total + transaction.amount;
      }, 0);

      if (currentCredits < validatedData.creditsToUse) {
        throw new Error(`Insufficient credits. Available: ${currentCredits}, Required: ${validatedData.creditsToUse}`);
      }

      // 7. Check if student already has a session at this time
      const studentConflict = await tx.sessionBooking.findFirst({
        where: {
          studentId: validatedData.studentId,
          scheduledDate: scheduledDate,
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
          OR: [
            {
              AND: [
                { startTime: { lte: requestStartTime } },
                { endTime: { gt: requestStartTime } }
              ]
            },
            {
              AND: [
                { startTime: { lt: requestEndTime } },
                { endTime: { gte: requestEndTime } }
              ]
            }
          ]
        }
      });

      if (studentConflict) {
        throw new Error('You already have a session scheduled at this time');
      }

      // 8. Create the session
      const sessionBooking = await tx.sessionBooking.create({
        data: {
          studentId: validatedData.studentId,
          coachId: validatedData.coachId,
          parentId: parentId,
          subject: validatedData.subject,
          title: validatedData.title,
          description: validatedData.description,
          scheduledDate: scheduledDate,
          startTime: requestStartTime,
          endTime: requestEndTime,
          duration: validatedData.duration,
          type: validatedData.type,
          modality: validatedData.modality,
          creditsUsed: validatedData.creditsToUse,
          status: 'SCHEDULED'
        },
        include: {
          student: true,
          coach: true,
          parent: true
        }
      });

      // 9. Create credit transaction for usage (idempotent via DB constraint)
      // Check for existing USAGE transaction to avoid constraint violation
      const existingUsage = await tx.creditTransaction.findFirst({
        where: {
          sessionId: sessionBooking.id,
          type: 'USAGE'
        }
      });

      if (!existingUsage) {
        await tx.creditTransaction.create({
          data: {
            studentId: studentRecord.id,
            type: 'USAGE',
            amount: -validatedData.creditsToUse,
            description: `Session booking: ${validatedData.title} - ${validatedData.subject}`,
            sessionId: sessionBooking.id
          }
        });
      }

      // 10. Create notifications
      const notifications: Prisma.SessionNotificationCreateManyInput[] = [];

      // Notify coach
      notifications.push({
        sessionId: sessionBooking.id,
        userId: coachProfile.user.id,
        type: 'SESSION_BOOKED',
        title: 'Nouvelle session réservée',
        message: `${student.firstName} ${student.lastName} a réservé une session de ${validatedData.subject} pour le ${scheduledDate.toLocaleDateString('fr-FR')} à ${validatedData.startTime}`,
        method: 'EMAIL'
      });

      // Notify assistant
      const assistants = await tx.user.findMany({
        where: { role: 'ASSISTANTE' }
      });

      for (const assistant of assistants) {
        notifications.push({
          sessionId: sessionBooking.id,
          userId: assistant.id,
          type: 'SESSION_BOOKED',
          title: 'Nouvelle session planifiée',
          message: `Session ${validatedData.subject} entre ${coachProfile.user.firstName} ${coachProfile.user.lastName} et ${student.firstName} ${student.lastName} programmée pour le ${scheduledDate.toLocaleDateString('fr-FR')} à ${validatedData.startTime}`,
          method: 'IN_APP'
        });
      }

      // Notify parent if different from booking user
      if (parentId && parentId !== session.user.id) {
        notifications.push({
          sessionId: sessionBooking.id,
          userId: parentId,
          type: 'SESSION_BOOKED',
          title: 'Session réservée pour votre enfant',
          message: `Session de ${validatedData.subject} avec ${coachProfile.user.firstName} ${coachProfile.user.lastName} programmée pour ${student.firstName} le ${scheduledDate.toLocaleDateString('fr-FR')} à ${validatedData.startTime}`,
          method: 'EMAIL'
        });
      }

      // Create all notifications
      await tx.sessionNotification.createMany({
        data: notifications
      });

      // 11. Create reminders
      const reminders: Prisma.SessionReminderCreateManyInput[] = [];
      const sessionDateTime = new Date(`${validatedData.scheduledDate}T${validatedData.startTime}`);

      // 1 day before
      reminders.push({
        sessionId: sessionBooking.id,
        reminderType: 'ONE_DAY_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 24 * 60 * 60 * 1000)
      });

      // 2 hours before
      reminders.push({
        sessionId: sessionBooking.id,
        reminderType: 'TWO_HOURS_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 2 * 60 * 60 * 1000)
      });

      // 30 minutes before
      reminders.push({
        sessionId: sessionBooking.id,
        reminderType: 'THIRTY_MINUTES_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 30 * 60 * 1000)
      });

      await tx.sessionReminder.createMany({
        data: reminders
      });

      return sessionBooking;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000  // 15 seconds timeout for complex booking logic
    });

    // Send immediate notifications (implement email service)
    // await sendSessionBookingNotifications(result.id);

    logger.logRequest(HttpStatus.CREATED, {
      sessionId: result.id,
      coachId: validatedData.coachId,
      studentId: validatedData.studentId,
      subject: validatedData.subject
    });

    return successResponse({
      success: true,
      sessionId: result.id,
      message: 'Session booked successfully',
      session: result
    }, HttpStatus.CREATED);

  } catch (error) {
    logger.error('Failed to book session', error);

    // Handle database constraint violations and transaction errors
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { code: string; meta?: Record<string, unknown> };

      // 23P01: Exclusion constraint violation (overlapping sessions)
      if (dbError.code === '23P01') {
        logger.logRequest(HttpStatus.CONFLICT);
        return ApiError.conflict('Coach already has a session at this time. Please choose a different time slot.').toResponse();
      }

      // P2002: Unique constraint violation (duplicate transaction attempt)
      if (dbError.code === 'P2002') {
        logger.logRequest(HttpStatus.CONFLICT);
        return ApiError.conflict('This session has already been booked. Please refresh and try again.').toResponse();
      }

      // P2034: Transaction failed due to serialization conflict
      if (dbError.code === 'P2034') {
        logger.logRequest(HttpStatus.CONFLICT);
        return ApiError.conflict('Booking conflict detected. Please try again.').toResponse();
      }
    }

    logger.logRequest(HttpStatus.INTERNAL_SERVER_ERROR);
    return await handleApiError(error, 'POST /api/sessions/book');
  }
}
