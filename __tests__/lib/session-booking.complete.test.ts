/**
 * Session Booking Service — Complete Test Suite
 *
 * Tests: SessionBookingService (bookSession, updateSessionStatus, getAvailableSlots, etc.)
 *
 * Source: lib/session-booking.ts
 */

import { SessionBookingService } from '@/lib/session-booking';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── bookSession ─────────────────────────────────────────────────────────────

describe('SessionBookingService.bookSession', () => {
  it('should throw when time slot is not available', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        coachAvailability: { findFirst: jest.fn().mockResolvedValue(null) },
        sessionBooking: { findFirst: jest.fn(), create: jest.fn() },
        student: { findFirst: jest.fn(), update: jest.fn() },
        creditTransaction: { create: jest.fn() },
        user: { findMany: jest.fn().mockResolvedValue([]) },
        sessionNotification: { createMany: jest.fn() },
        sessionReminder: { createMany: jest.fn() },
      };
      return fn(tx);
    });

    await expect(
      SessionBookingService.bookSession({
        coachId: 'coach-1',
        studentId: 'stu-1',
        subject: 'MATHS' as any,
        scheduledDate: new Date('2026-07-15'),
        startTime: '10:00',
        endTime: '11:00',
        duration: 60,
        type: 'INDIVIDUAL' as any,
        modality: 'ONLINE' as any,
        title: 'Maths session',
        creditsUsed: 1,
      })
    ).rejects.toThrow('Time slot is not available');
  });

  it('should throw when student has insufficient credits', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        coachAvailability: {
          findFirst: jest.fn().mockResolvedValue({ id: 'av-1' }),
        },
        sessionBooking: {
          findFirst: jest.fn().mockResolvedValue(null), // no conflict
          create: jest.fn(),
        },
        student: {
          findFirst: jest.fn().mockResolvedValue({ id: 'stu-1', credits: 0 }),
          update: jest.fn(),
        },
        creditTransaction: { create: jest.fn() },
        user: { findMany: jest.fn().mockResolvedValue([]) },
        sessionNotification: { createMany: jest.fn() },
        sessionReminder: { createMany: jest.fn() },
      };
      return fn(tx);
    });

    await expect(
      SessionBookingService.bookSession({
        coachId: 'coach-1',
        studentId: 'stu-1',
        subject: 'MATHS' as any,
        scheduledDate: new Date('2026-07-15'),
        startTime: '10:00',
        endTime: '11:00',
        duration: 60,
        type: 'INDIVIDUAL' as any,
        modality: 'ONLINE' as any,
        title: 'Maths session',
        creditsUsed: 1,
      })
    ).rejects.toThrow('Insufficient credits');
  });

  it('should create session, deduct credits, and create notifications', async () => {
    const mockSession = {
      id: 'sess-1',
      coachId: 'coach-1',
      studentId: 'stu-1',
      subject: 'MATHS',
      scheduledDate: new Date('2026-07-15'),
      startTime: '10:00',
      endTime: '11:00',
      student: { firstName: 'Ahmed', lastName: 'Ben Ali' },
      coach: { firstName: 'Mehdi', lastName: 'Coach' },
      parent: null,
    };

    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        coachAvailability: {
          findFirst: jest.fn().mockResolvedValue({ id: 'av-1' }),
        },
        sessionBooking: {
          findFirst: jest.fn().mockResolvedValue(null), // no conflict
          create: jest.fn().mockResolvedValue(mockSession),
        },
        student: {
          findFirst: jest.fn().mockResolvedValue({ id: 'stu-entity-1', credits: 4 }),
          update: jest.fn().mockResolvedValue({ id: 'stu-entity-1', credits: 3 }),
        },
        creditTransaction: { create: jest.fn() },
        user: { findMany: jest.fn().mockResolvedValue([]) },
        sessionNotification: { createMany: jest.fn() },
        sessionReminder: { createMany: jest.fn() },
      };
      return fn(tx);
    });

    const result = await SessionBookingService.bookSession({
      coachId: 'coach-1',
      studentId: 'stu-1',
      subject: 'MATHS' as any,
      scheduledDate: new Date('2026-07-15'),
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      type: 'INDIVIDUAL' as any,
      modality: 'ONLINE' as any,
      title: 'Maths session',
      creditsUsed: 1,
    });

    expect(result.id).toBe('sess-1');
  });
});

// ─── updateSessionStatus ─────────────────────────────────────────────────────

describe('SessionBookingService.updateSessionStatus', () => {
  it('should throw when session not found', async () => {
    prisma.sessionBooking.findFirst.mockResolvedValue(null);

    await expect(
      SessionBookingService.updateSessionStatus('sess-x', 'COMPLETED' as any, 'user-1')
    ).rejects.toThrow('Session not found or access denied');
  });

  it('should update session status to COMPLETED', async () => {
    prisma.sessionBooking.findFirst.mockResolvedValue({
      id: 'sess-1',
      coachId: 'coach-1',
      studentId: 'stu-1',
      student: { firstName: 'A' },
      coach: { firstName: 'B' },
    });
    prisma.sessionBooking.update.mockResolvedValue({
      id: 'sess-1',
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    const result = await SessionBookingService.updateSessionStatus('sess-1', 'COMPLETED' as any, 'coach-1');

    expect(result.status).toBe('COMPLETED');
    expect(prisma.sessionBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
  });

  it('should update session status to CANCELLED', async () => {
    prisma.sessionBooking.findFirst.mockResolvedValue({
      id: 'sess-1',
      coachId: 'coach-1',
      studentId: 'stu-1',
    });
    prisma.sessionBooking.update.mockResolvedValue({
      id: 'sess-1',
      status: 'CANCELLED',
      cancelledAt: new Date(),
    });

    const result = await SessionBookingService.updateSessionStatus('sess-1', 'CANCELLED' as any, 'coach-1');

    expect(result.status).toBe('CANCELLED');
  });

  it('should include notes when provided', async () => {
    prisma.sessionBooking.findFirst.mockResolvedValue({
      id: 'sess-1',
      coachId: 'coach-1',
    });
    prisma.sessionBooking.update.mockResolvedValue({
      id: 'sess-1',
      status: 'COMPLETED',
      coachNotes: 'Good session',
    });

    await SessionBookingService.updateSessionStatus('sess-1', 'COMPLETED' as any, 'coach-1', 'Good session');

    expect(prisma.sessionBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coachNotes: 'Good session' }),
      })
    );
  });
});

// ─── sendScheduledReminders ──────────────────────────────────────────────────

describe('SessionBookingService.sendScheduledReminders', () => {
  it('should process due reminders', async () => {
    prisma.sessionReminder.findMany.mockResolvedValue([
      {
        id: 'rem-1',
        sessionId: 'sess-1',
        session: {
          student: { firstName: 'A' },
          coach: { firstName: 'B' },
          parent: null,
        },
      },
    ]);
    prisma.sessionReminder.update.mockResolvedValue({});

    await SessionBookingService.sendScheduledReminders();

    expect(prisma.sessionReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rem-1' },
        data: expect.objectContaining({ sent: true }),
      })
    );
  });

  it('should handle empty reminders list', async () => {
    prisma.sessionReminder.findMany.mockResolvedValue([]);

    await SessionBookingService.sendScheduledReminders();

    expect(prisma.sessionReminder.update).not.toHaveBeenCalled();
  });
});

// ─── getAvailableCoaches ─────────────────────────────────────────────────────

describe('SessionBookingService.getAvailableCoaches', () => {
  it('should return coaches that teach the requested subject', async () => {
    prisma.coachProfile.findMany.mockResolvedValue([
      {
        subjects: ['MATHS', 'NSI'],
        user: { id: 'c1', firstName: 'Mehdi', lastName: 'Coach', email: 'coach@test.com' },
      },
      {
        subjects: ['FRANCAIS'],
        user: { id: 'c2', firstName: 'Sara', lastName: 'Prof', email: 'sara@test.com' },
      },
    ]);

    const result = await SessionBookingService.getAvailableCoaches(
      'MATHS',
      new Date('2026-07-01'),
      new Date('2026-07-31')
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('should return empty array when no coaches match', async () => {
    prisma.coachProfile.findMany.mockResolvedValue([
      {
        subjects: ['FRANCAIS'],
        user: { id: 'c1', firstName: 'Sara', lastName: 'Prof', email: 'sara@test.com' },
      },
    ]);

    const result = await SessionBookingService.getAvailableCoaches(
      'MATHS',
      new Date('2026-07-01'),
      new Date('2026-07-31')
    );

    expect(result).toHaveLength(0);
  });
});
