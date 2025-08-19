import { prisma } from '@/lib/prisma';
// import { sendEmail } from '@/lib/email';

export interface AvailableSlot {
  coachId: string;
  coachName: string;
  coachSubjects: string[];
  date: Date;
  startTime: string;
  endTime: string;
  duration: number;
  isSpecificDate: boolean;
}

export interface SessionBookingData {
  coachId: string;
  studentId: string;
  parentId?: string;
  subject: string;
  scheduledDate: Date;
  startTime: string;
  endTime: string;
  duration: number;
  type: 'INDIVIDUAL' | 'GROUP' | 'MASTERCLASS';
  modality: 'ONLINE' | 'IN_PERSON' | 'HYBRID';
  title: string;
  description?: string;
  creditsUsed: number;
}

export class SessionBookingService {

  /**
   * Get available time slots for a specific coach and date range
   */
  static async getAvailableSlots(
    coachId: string,
    startDate: Date,
    endDate: Date,
    subject?: string
  ): Promise<AvailableSlot[]> {
    // Get coach's availability
    const availability = await prisma.coachAvailability.findMany({
      where: {
        coachId,
        isAvailable: true,
        OR: [
          {
            // Recurring availability
            isRecurring: true,
            specificDate: null,
            validFrom: { lte: endDate },
            OR: [
              { validUntil: null },
              { validUntil: { gte: startDate } }
            ]
          },
          {
            // Specific date availability
            isRecurring: false,
            specificDate: {
              gte: startDate,
              lte: endDate
            }
          }
        ]
      },
      include: {
        coach: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });

    // Get coach profile to get subjects
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
      select: { subjects: true }
    });

    const coachSubjects = coachProfile ? JSON.parse(coachProfile.subjects || '[]') : [];

    // Get existing bookings
    const bookedSlots = await prisma.sessionBooking.findMany({
      where: {
        coachId,
        scheduledDate: {
          gte: startDate,
          lte: endDate
        },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] }
      },
      select: {
        scheduledDate: true,
        startTime: true,
        endTime: true
      }
    });

    const availableSlots: AvailableSlot[] = [];

    // Generate available slots for each day in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      // Check for specific date availability first
      const specificAvailability = availability.filter(
        (av: { specificDate: Date | null; }) =>
          av.specificDate &&
          av.specificDate.toDateString() === currentDate.toDateString()
      );

      // If no specific availability, check recurring availability
      const recurringAvailability = specificAvailability.length === 0
        ? availability.filter(
          (av: any) => av.isRecurring &&
            av.dayOfWeek === dayOfWeek &&
            (!av.validFrom || av.validFrom <= currentDate) &&
            (!av.validUntil || av.validUntil >= currentDate)
        )
        : [];

      const dayAvailability = [...specificAvailability, ...recurringAvailability];

      for (const slot of dayAvailability) {
        // Check if subject matches if specified
        if (subject && !coachSubjects.includes(subject)) {
          continue;
        }

        // Check if slot is not booked
        const isBooked = bookedSlots.some((booking: { scheduledDate: Date; startTime: string; endTime: string; }) =>
          booking.scheduledDate.toDateString() === currentDate.toDateString() &&
          this.timesOverlap(
            slot.startTime,
            slot.endTime,
            booking.startTime,
            booking.endTime
          )
        );

        if (!isBooked) {
          availableSlots.push({
            coachId: slot.coachId,
            coachName: `${slot.coach.firstName} ${slot.coach.lastName}`,
            coachSubjects: coachSubjects,
            date: new Date(currentDate),
            startTime: slot.startTime,
            endTime: slot.endTime,
            duration: this.calculateDuration(slot.startTime, slot.endTime),
            isSpecificDate: !slot.isRecurring
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots;
  }

  /**
   * Get all available coaches for a specific subject
   */
  static async getAvailableCoaches(
    subject: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const coaches = await prisma.user.findMany({
      where: {
        role: 'COACH',
        coachProfile: {
          subjects: {
            contains: subject
          }
        }
      },
      include: {
        coachProfile: true,
        coachAvailabilities: {
          where: {
            isAvailable: true,
            OR: [
              {
                isRecurring: true,
                specificDate: null,
                validFrom: { lte: endDate },
                OR: [
                  { validUntil: null },
                  { validUntil: { gte: startDate } }
                ]
              },
              {
                isRecurring: false,
                specificDate: {
                  gte: startDate,
                  lte: endDate
                }
              }
            ]
          }
        }
      }
    });

    // Filter coaches who have actual availability and format response
    return coaches
      .filter((coach: { coachAvailabilities: any[]; }) => coach.coachAvailabilities.length > 0)
      .map((coach: any) => ({
        id: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        email: coach.email,
        coachSubjects: JSON.parse(coach.coachProfile?.subjects || '[]'),
        coachAvailabilities: coach.coachAvailabilities
      }));
  }

  /**
   * Book a session with all validations and notifications
   */
  static async bookSession(data: SessionBookingData): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // Validate availability
      const isAvailable = await this.validateAvailability(
        data.coachId,
        data.scheduledDate,
        data.startTime,
        data.endTime,
        tx as any
      );

      if (!isAvailable) {
        throw new Error('Time slot is not available');
      }

      // Check credits
      await this.validateCredits(data.studentId, data.creditsUsed, tx);

      // Create session
      const session = await tx.sessionBooking.create({
        data: {
          studentId: data.studentId,
          coachId: data.coachId,
          parentId: data.parentId,
          subject: data.subject as any,
          title: data.title,
          description: data.description,
          scheduledDate: data.scheduledDate,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: data.duration,
          type: data.type as any,
          modality: data.modality as any,
          creditsUsed: data.creditsUsed,
          status: 'SCHEDULED'
        },
        include: {
          student: true,
          coach: true,
          parent: true
        }
      });

      // Deduct credits from student
      await tx.student.update({
        where: { userId: data.studentId },
        data: { credits: { decrement: data.creditsUsed } }
      });

      // Create notifications
      await this.createSessionNotifications(session, tx);

      // Create reminders
      await this.createSessionReminders(session, tx);

      return session;
    });
  }

  /**
   * Update session status
   */
  static async updateSessionStatus(
    sessionId: string,
    status: string,
    userId: string,
    notes?: string
  ): Promise<any> {
    const session = await prisma.sessionBooking.findFirst({
      where: {
        id: sessionId,
        OR: [
          { coachId: userId },
          { studentId: userId },
          { parentId: userId }
        ]
      },
      include: {
        student: true,
        coach: true,
        parent: true
      }
    });

    if (!session) {
      throw new Error('Session not found or access denied');
    }

    const updatedSession = await prisma.sessionBooking.update({
      where: { id: sessionId },
      data: {
        status: status as any,
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
        ...(status === 'CANCELLED' && { cancelledAt: new Date() }),
        ...(notes && { coachNotes: notes })
      }
    });

    // Create status change notifications
    await this.createStatusChangeNotifications(updatedSession, status);

    return updatedSession;
  }

  /**
   * Send session reminders
   */
  static async sendScheduledReminders(): Promise<void> {
    const now = new Date();

    const dueReminders = await prisma.sessionReminder.findMany({
      where: {
        sent: false,
        scheduledFor: { lte: now }
      },
      include: {
        session: {
          include: {
            student: true,
            coach: true,
            parent: true
          }
        }
      }
    });

    for (const reminder of dueReminders) {
      try {
        await this.sendReminder(reminder);

        await prisma.sessionReminder.update({
          where: { id: reminder.id },
          data: {
            sent: true,
            sentAt: new Date()
          }
        });
      } catch (error) {
        console.error(`Failed to send reminder ${reminder.id}:`, error);
      }
    }
  }

  // Helper methods
  private static timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    return start1 < end2 && end1 > start2;
  }

  private static calculateDuration(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return endMinutes - startMinutes;
  }

  private static async validateAvailability(
    coachId: string,
    date: Date,
    startTime: string,
    endTime: string,
    tx: any
  ): Promise<boolean> {
    // Check availability
    const availability = await tx.coachAvailability.findFirst({
      where: {
        coachId,
        isAvailable: true,
        OR: [
          {
            dayOfWeek: date.getDay(),
            isRecurring: true,
            startTime: { lte: startTime },
            endTime: { gte: endTime },
            validFrom: { lte: date },
            OR: [
              { validUntil: null },
              { validUntil: { gte: date } }
            ]
          },
          {
            specificDate: date,
            startTime: { lte: startTime },
            endTime: { gte: endTime }
          }
        ]
      }
    });

    if (!availability) return false;

    // Check for conflicts
    const conflict = await tx.sessionBooking.findFirst({
      where: {
        coachId,
        scheduledDate: date,
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } }
            ]
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } }
            ]
          }
        ]
      }
    });

    return !conflict;
  }

  private static async validateCredits(
    studentId: string,
    creditsNeeded: number,
    tx: any
  ): Promise<void> {
    const student = await tx.student.findFirst({
      where: { userId: studentId }
    });

    if (!student || student.credits < creditsNeeded) {
      throw new Error('Insufficient credits');
    }
  }

  private static async createSessionNotifications(session: any, tx: any): Promise<void> {
    const notifications = [];

    // Notify coach
    notifications.push({
      sessionId: session.id,
      userId: session.coachId,
      type: 'SESSION_BOOKED',
      title: 'Nouvelle session réservée',
      message: `${session.student.firstName} ${session.student.lastName} a réservé une session`,
      method: 'EMAIL'
    });

    // Notify assistants
    const assistants = await tx.user.findMany({
      where: { role: 'ASSISTANTE' }
    });

    for (const assistant of assistants) {
      notifications.push({
        sessionId: session.id,
        userId: assistant.id,
        type: 'SESSION_BOOKED',
        title: 'Nouvelle session planifiée',
        message: `Session programmée entre ${session.coach.firstName} et ${session.student.firstName}`,
        method: 'IN_APP'
      });
    }

    await tx.sessionNotification.createMany({
      data: notifications
    });
  }

  private static async createSessionReminders(session: any, tx: any): Promise<void> {
    const sessionDateTime = new Date(`${session.scheduledDate.toISOString().split('T')[0]}T${session.startTime}`);

    const reminders = [
      {
        sessionId: session.id,
        reminderType: 'ONE_DAY_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 24 * 60 * 60 * 1000)
      },
      {
        sessionId: session.id,
        reminderType: 'TWO_HOURS_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 2 * 60 * 60 * 1000)
      },
      {
        sessionId: session.id,
        reminderType: 'THIRTY_MINUTES_BEFORE',
        scheduledFor: new Date(sessionDateTime.getTime() - 30 * 60 * 1000)
      }
    ];

    await tx.sessionReminder.createMany({
      data: reminders
    });
  }

  private static async createStatusChangeNotifications(session: any, status: string): Promise<void> {
    // Implementation for status change notifications
  }

  private static async sendReminder(reminder: any): Promise<void> {
    // Implementation for sending reminders
  }
}
