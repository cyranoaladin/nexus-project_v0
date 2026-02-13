import { SessionBookingService } from '@/lib/session-booking';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachAvailability: { findMany: jest.fn() },
    coachProfile: { findUnique: jest.fn(), findMany: jest.fn() },
    sessionBooking: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    sessionReminder: { findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock(
  '@prisma/client',
  () => ({
    SessionStatus: { SCHEDULED: 'SCHEDULED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' },
  }),
  { virtual: true }
);

describe('SessionBookingService', () => {
  const coachId = 'coach-1';
  const startDate = new Date('2026-02-10T00:00:00.000Z');
  const endDate = new Date('2026-02-11T23:59:59.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns available slots and respects specific date availability', async () => {
    const date1 = new Date('2026-02-10T00:00:00.000Z');
    const date2 = new Date('2026-02-11T00:00:00.000Z');

    (prisma.coachAvailability.findMany as jest.Mock).mockResolvedValue([
      {
        coachId,
        isAvailable: true,
        isRecurring: false,
        specificDate: date1,
        dayOfWeek: date1.getDay(),
        startTime: '10:00',
        endTime: '11:00',
        coach: { firstName: 'Jane', lastName: 'Doe' },
      },
      {
        coachId,
        isAvailable: true,
        isRecurring: true,
        specificDate: null,
        dayOfWeek: date1.getDay(),
        startTime: '09:00',
        endTime: '10:00',
        coach: { firstName: 'Jane', lastName: 'Doe' },
      },
      {
        coachId,
        isAvailable: true,
        isRecurring: true,
        specificDate: null,
        dayOfWeek: date2.getDay(),
        startTime: '14:00',
        endTime: '15:00',
        coach: { firstName: 'Jane', lastName: 'Doe' },
      },
    ]);

    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      subjects: JSON.stringify(['MATHEMATIQUES']),
    });

    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      {
        scheduledDate: date2,
        startTime: '14:00',
        endTime: '15:00',
      },
    ]);

    const slots = await SessionBookingService.getAvailableSlots(
      coachId,
      startDate,
      endDate,
      'MATHEMATIQUES'
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe('10:00');
    expect(slots[0].endTime).toBe('11:00');
    expect(slots[0].duration).toBe(60);
    expect(slots[0].isSpecificDate).toBe(true);
    expect(slots[0].coachName).toBe('Jane Doe');
  });

  it('filters by subject when provided', async () => {
    (prisma.coachAvailability.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      subjects: JSON.stringify(['MATHEMATIQUES']),
    });
    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

    const slots = await SessionBookingService.getAvailableSlots(
      coachId,
      startDate,
      endDate,
      'NSI'
    );

    expect(slots).toHaveLength(0);
  });

  it('returns available coaches with parsed subjects', async () => {
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
      {
        subjects: JSON.stringify(['MATHEMATIQUES', 'NSI']),
        user: {
          id: coachId,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
        },
      },
    ]);

    const coaches = await SessionBookingService.getAvailableCoaches(
      'MATHEMATIQUES',
      startDate,
      endDate
    );

    expect(coaches).toHaveLength(1);
    expect(coaches[0].id).toBe(coachId);
    expect(coaches[0].coachSubjects).toEqual(['MATHEMATIQUES', 'NSI']);
  });

  it('books a session and creates credits/notifications/reminders', async () => {
    const tx = {
      coachAvailability: { findFirst: jest.fn().mockResolvedValue({ id: 'avail-1' }) },
      sessionBooking: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      student: {
        findFirst: jest.fn().mockResolvedValue({ id: 'student-entity-1', credits: 5 }),
        update: jest.fn().mockResolvedValue({ id: 'student-entity-1', credits: 4 }),
      },
      creditTransaction: { create: jest.fn() },
      sessionNotification: { createMany: jest.fn() },
      sessionReminder: { createMany: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const createdSession = {
      id: 'session-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      parentId: 'parent-1',
      subject: 'MATHEMATIQUES',
      title: 'Maths',
      description: 'Desc',
      scheduledDate: startDate,
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      type: 'COURS_ONLINE',
      modality: 'VISIO',
      creditsUsed: 1,
      status: 'SCHEDULED',
      student: { firstName: 'Ana', lastName: 'Doe' },
      coach: { firstName: 'Jane', lastName: 'Doe' },
      parent: { firstName: 'Parent', lastName: 'One' },
    };

    tx.sessionBooking.create.mockResolvedValue(createdSession);

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));

    const session = await SessionBookingService.bookSession({
      coachId: 'coach-1',
      studentId: 'student-1',
      parentId: 'parent-1',
      subject: 'MATHEMATIQUES' as any,
      scheduledDate: startDate,
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      type: 'COURS_ONLINE' as any,
      modality: 'VISIO' as any,
      title: 'Maths',
      description: 'Desc',
      creditsUsed: 1,
    });

    expect(session.id).toBe('session-1');
    expect(tx.sessionBooking.create).toHaveBeenCalled();
    expect(tx.student.update).toHaveBeenCalled();
    expect(tx.creditTransaction.create).toHaveBeenCalled();
    expect(tx.sessionNotification.createMany).toHaveBeenCalled();
    expect(tx.sessionReminder.createMany).toHaveBeenCalled();
  });

  it('rejects booking when slot is not available', async () => {
    const tx = {
      coachAvailability: { findFirst: jest.fn().mockResolvedValue(null) },
      sessionBooking: { findFirst: jest.fn() },
      student: { findFirst: jest.fn() },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));

    await expect(
      SessionBookingService.bookSession({
        coachId: 'coach-1',
        studentId: 'student-1',
        subject: 'MATHEMATIQUES' as any,
        scheduledDate: startDate,
        startTime: '10:00',
        endTime: '11:00',
        duration: 60,
        type: 'COURS_ONLINE' as any,
        modality: 'VISIO' as any,
        title: 'Maths',
        creditsUsed: 1,
      })
    ).rejects.toThrow('Time slot is not available');
  });

  it('rejects booking when credits are insufficient', async () => {
    const tx = {
      coachAvailability: { findFirst: jest.fn().mockResolvedValue({ id: 'avail-1' }) },
      sessionBooking: { findFirst: jest.fn().mockResolvedValue(null) },
      student: { findFirst: jest.fn().mockResolvedValue({ id: 's1', credits: 0 }) },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));

    await expect(
      SessionBookingService.bookSession({
        coachId: 'coach-1',
        studentId: 'student-1',
        subject: 'MATHEMATIQUES' as any,
        scheduledDate: startDate,
        startTime: '10:00',
        endTime: '11:00',
        duration: 60,
        type: 'COURS_ONLINE' as any,
        modality: 'VISIO' as any,
        title: 'Maths',
        creditsUsed: 1,
      })
    ).rejects.toThrow('Insufficient credits');
  });

  it('updates session status and triggers notifications', async () => {
    const session = {
      id: 'session-2',
      coachId: 'coach-1',
      studentId: 'student-1',
      parentId: 'parent-1',
    };

    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(session);
    (prisma.sessionBooking.update as jest.Mock).mockResolvedValue({ id: 'session-2', status: 'COMPLETED' });

    const notifySpy = jest.spyOn(SessionBookingService as any, 'createStatusChangeNotifications').mockResolvedValue(undefined);

    const updated = await SessionBookingService.updateSessionStatus(
      'session-2',
      'COMPLETED' as any,
      'coach-1',
      'notes'
    );

    expect(updated.id).toBe('session-2');
    expect(prisma.sessionBooking.update).toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalled();
  });

  it('throws when session not found on status update', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      SessionBookingService.updateSessionStatus('missing', 'CANCELLED' as any, 'coach-1')
    ).rejects.toThrow('Session not found or access denied');
  });

  it('sends scheduled reminders and marks them as sent', async () => {
    const reminder = {
      id: 'reminder-1',
      sessionId: 'session-1',
      session: { id: 'session-1' },
    };
    (prisma.sessionReminder.findMany as jest.Mock).mockResolvedValue([reminder]);
    (prisma.sessionReminder.update as jest.Mock).mockResolvedValue({ id: 'reminder-1' });

    const sendSpy = jest.spyOn(SessionBookingService as any, 'sendReminder').mockResolvedValue(undefined);

    await SessionBookingService.sendScheduledReminders();

    expect(sendSpy).toHaveBeenCalledWith(reminder);
    expect(prisma.sessionReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'reminder-1' } })
    );
  });
});
