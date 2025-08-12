import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

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

// Enhanced validation schema with better date and time controls
const bookSessionSchema = z.object({
  coachId: z.string().min(1, 'Coach ID is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  subject: z.enum(['MATHEMATIQUES', 'NSI', 'FRANCAIS', 'PHILOSOPHIE', 'HISTOIRE_GEO', 'ANGLAIS', 'ESPAGNOL', 'PHYSIQUE_CHIMIE', 'SVT', 'SES']),
  scheduledDate: z.string().min(1, 'Date is required').refine((date: any) => {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, 'Cannot book sessions in the past'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  duration: z.number().min(30).max(180), // 30 minutes to 3 hours
  type: z.enum(['INDIVIDUAL', 'GROUP', 'MASTERCLASS']).default('INDIVIDUAL'),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).default('ONLINE'),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  creditsToUse: z.number().min(1).max(10, 'Cannot use more than 10 credits per session'),
}).refine((data: any) => {
  // Validate that end time is after start time
  const startTime = data.startTime.split(':').map(Number);
  const endTime = data.endTime.split(':').map(Number);
  const startMinutes = startTime[0] * 60 + startTime[1];
  const endMinutes = endTime[0] * 60 + endTime[1];
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['endTime']
}).refine((data: any) => {
  // Validate that duration matches start and end time
  const startTime = data.startTime.split(':').map(Number);
  const endTime = data.endTime.split(':').map(Number);
  const startMinutes = startTime[0] * 60 + startTime[1];
  const endMinutes = endTime[0] * 60 + endTime[1];
  const calculatedDuration = endMinutes - startMinutes;
  return calculatedDuration === data.duration;
}, {
  message: 'Duration must match the time difference between start and end time',
  path: ['duration']
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('Session booking request - Session:', session);
    console.log('Session booking request - User:', session?.user);
    
    if (!session?.user) {
      console.log('Session booking error: No session or user');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    console.log('Session booking request - Body:', body);
    const validatedData = bookSessionSchema.parse(body) as z.infer<typeof bookSessionSchema>;

    // Normalize times to HH:MM to ensure correct string comparisons in DB
    const requestStartTime = normalizeTime(validatedData.startTime);
    const requestEndTime = normalizeTime(validatedData.endTime);

    console.log('Session booking request - User role:', session.user.role);
    console.log('Session booking request - Allowed roles:', ['PARENT', 'ELEVE']);

    // Check if user has permission to book (parent or student)
    if (!['PARENT', 'ELEVE'].includes(session.user.role)) {
      console.log('Session booking error: Unauthorized role:', session.user.role);
      return NextResponse.json(
        { error: 'Only parents and students can book sessions' },
        { status: 403 }
      );
    }

    // Additional business logic validation
    const scheduledDate = parseLocalDate(validatedData.scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if booking is too far in the future (max 3 months)
    const maxBookingDate = new Date();
    maxBookingDate.setMonth(maxBookingDate.getMonth() + 3);
    if (scheduledDate > maxBookingDate) {
      return NextResponse.json(
        { error: 'Cannot book sessions more than 3 months in advance' },
        { status: 400 }
      );
    }

    // Check if booking is on a weekend (optional business rule)
    const dayOfWeek = scheduledDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json(
        { error: 'Sessions cannot be booked on weekends' },
        { status: 400 }
      );
    }

    // Check if booking is outside business hours (8 AM to 8 PM)
    const startHour = parseInt(requestStartTime.split(':')[0]);
    const endHour = parseInt(requestEndTime.split(':')[0]);
    if (startHour < 8 || endHour > 20) {
      return NextResponse.json(
        { error: 'Sessions must be between 8:00 AM and 8:00 PM' },
        { status: 400 }
      );
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Validate coach exists and teaches the subject
      const coachProfile = await tx.coachProfile.findFirst({
        where: {
          userId: validatedData.coachId,
          subjects: {
            contains: validatedData.subject
          }
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

      const currentCredits = creditTransactions.reduce((total: number, transaction: any) => {
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

      // 9. Create credit transaction for usage
      await tx.creditTransaction.create({
        data: {
          studentId: studentRecord.id,
          type: 'USAGE',
          amount: -validatedData.creditsToUse,
          description: `Session booking: ${validatedData.title} - ${validatedData.subject}`,
          sessionId: sessionBooking.id
        }
      });

      // 10. Create notifications
      const notifications: any[] = [];

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
        data: notifications as any
      });

      // 11. Create reminders
      const reminders: any[] = [];
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
        data: reminders as any
      });

      return sessionBooking;
    });

    // Send immediate notifications (implement email service)
    // await sendSessionBookingNotifications(result.id);

    return NextResponse.json({
      success: true,
      sessionId: result.id,
      message: 'Session booked successfully',
      session: result
    });

  } catch (error) {
    console.error('Session booking error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to book session' },
      { status: 500 }
    );
  }
}
