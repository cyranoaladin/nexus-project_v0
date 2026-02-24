/**
 * Next Step Engine — Complete Test Suite
 *
 * Tests: getNextStep for all roles (PARENT, ELEVE, COACH, ASSISTANTE, ADMIN)
 *
 * Source: lib/next-step-engine.ts
 */

import { getNextStep } from '@/lib/next-step-engine';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── getNextStep — null cases ────────────────────────────────────────────────

describe('getNextStep — null cases', () => {
  it('should return null when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await getNextStep('nonexistent')).toBeNull();
  });

  it('should return null for unknown role', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'UNKNOWN_ROLE', parentProfile: null, student: null, coachProfile: null,
    });
    expect(await getNextStep('u1')).toBeNull();
  });

  it('should return null on error', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('DB down'));
    expect(await getNextStep('u1')).toBeNull();
  });
});

// ─── getNextStep — PARENT ────────────────────────────────────────────────────

describe('getNextStep — PARENT', () => {
  it('should return ADD_CHILD when no children', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'PARENT',
      parentProfile: { id: 'pp1', children: [] },
      student: null, coachProfile: null,
    });

    const step = await getNextStep('u1');
    expect(step).not.toBeNull();
    expect(step!.type).toBe('ADD_CHILD');
    expect(step!.priority).toBe('critical');
  });

  it('should return SUBSCRIBE when child has no subscription', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'PARENT',
      parentProfile: {
        id: 'pp1',
        children: [{ id: 's1', credits: 4, completedSessions: 0, totalSessions: 0, subscriptions: [] }],
      },
      student: null, coachProfile: null,
    });

    const step = await getNextStep('u1');
    expect(step!.type).toBe('SUBSCRIBE');
    expect(step!.priority).toBe('high');
  });

  it('should return BUY_CREDITS when child has no credits', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'PARENT',
      parentProfile: {
        id: 'pp1',
        children: [{ id: 's1', credits: 0, completedSessions: 0, totalSessions: 0, subscriptions: [{ id: 'sub1', planName: 'HYBRIDE' }] }],
      },
      student: null, coachProfile: null,
    });

    const step = await getNextStep('u1');
    expect(step!.type).toBe('BUY_CREDITS');
    expect(step!.priority).toBe('high');
  });

  it('should return BOOK_SESSION when no sessions completed and no upcoming', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'PARENT',
      parentProfile: {
        id: 'pp1',
        children: [{ id: 's1', credits: 4, completedSessions: 0, totalSessions: 0, subscriptions: [{ id: 'sub1', planName: 'HYBRIDE' }] }],
      },
      student: null, coachProfile: null,
    });
    prisma.diagnostic.count.mockResolvedValue(0);
    prisma.sessionBooking.findFirst.mockResolvedValue(null);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('BOOK_SESSION');
  });

  it('should return VIEW_PROGRESS when sessions completed and upcoming exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'PARENT',
      parentProfile: {
        id: 'pp1',
        children: [{ id: 's1', credits: 4, completedSessions: 3, totalSessions: 5, subscriptions: [{ id: 'sub1', planName: 'HYBRIDE' }] }],
      },
      student: null, coachProfile: null,
    });
    prisma.sessionBooking.findFirst.mockResolvedValue({
      scheduledDate: new Date('2026-07-15'),
      subject: 'MATHS',
    });

    const step = await getNextStep('u1');
    expect(step!.type).toBe('VIEW_PROGRESS');
    expect(step!.priority).toBe('low');
  });
});

// ─── getNextStep — ELEVE ─────────────────────────────────────────────────────

describe('getNextStep — ELEVE', () => {
  it('should return ACTIVATE_ACCOUNT when not activated', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ELEVE', activatedAt: null,
      student: { id: 's1', credits: 0, completedSessions: 0, totalSessions: 0, subscriptions: [] },
      parentProfile: null, coachProfile: null,
    });

    const step = await getNextStep('u1');
    expect(step!.type).toBe('ACTIVATE_ACCOUNT');
    expect(step!.priority).toBe('critical');
  });

  it('should return WAIT_PARENT when no student profile', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ELEVE', activatedAt: new Date(),
      student: null,
      parentProfile: null, coachProfile: null,
    });

    const step = await getNextStep('u1');
    expect(step!.type).toBe('WAIT_PARENT');
    expect(step!.priority).toBe('high');
  });

  it('should return VIEW_SESSION when upcoming session exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ELEVE', activatedAt: new Date(),
      student: { id: 's1', credits: 4, completedSessions: 2, totalSessions: 5, subscriptions: [{ id: 'sub1' }] },
      parentProfile: null, coachProfile: null,
    });
    prisma.sessionBooking.findFirst.mockResolvedValue({
      scheduledDate: new Date('2026-07-15'),
      subject: 'MATHS',
    });

    const step = await getNextStep('u1');
    expect(step!.type).toBe('VIEW_SESSION');
    expect(step!.priority).toBe('medium');
  });

  it('should return EXPLORE_RESOURCES when no upcoming session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ELEVE', activatedAt: new Date(),
      student: { id: 's1', credits: 4, completedSessions: 2, totalSessions: 5, subscriptions: [{ id: 'sub1' }] },
      parentProfile: null, coachProfile: null,
    });
    prisma.sessionBooking.findFirst.mockResolvedValue(null);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('EXPLORE_RESOURCES');
    expect(step!.priority).toBe('low');
  });
});

// ─── getNextStep — COACH ─────────────────────────────────────────────────────

describe('getNextStep — COACH', () => {
  it('should return COMPLETE_PROFILE when no coach profile', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'COACH', coachProfile: null,
      parentProfile: null, student: null,
    });

    const step = await getNextStep('u1');
    expect(step!.type).toBe('COMPLETE_PROFILE');
    expect(step!.priority).toBe('critical');
  });

  it('should return SUBMIT_REPORT when unreported sessions exist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'COACH', coachProfile: { id: 'cp1' },
      parentProfile: null, student: null,
    });
    prisma.sessionBooking.count.mockResolvedValueOnce(3); // unreported
    prisma.sessionBooking.count.mockResolvedValueOnce(0); // today

    const step = await getNextStep('u1');
    expect(step!.type).toBe('SUBMIT_REPORT');
    expect(step!.priority).toBe('high');
    expect(step!.message).toContain('3');
  });

  it('should return SET_AVAILABILITY when no availability slots', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'COACH', coachProfile: { id: 'cp1' },
      parentProfile: null, student: null,
    });
    prisma.sessionBooking.count.mockResolvedValueOnce(0); // unreported
    prisma.sessionBooking.count.mockResolvedValueOnce(0); // today
    prisma.coachAvailability.count.mockResolvedValue(0);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('SET_AVAILABILITY');
  });

  it('should return ALL_GOOD when everything is up to date', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'COACH', coachProfile: { id: 'cp1' },
      parentProfile: null, student: null,
    });
    prisma.sessionBooking.count.mockResolvedValueOnce(0); // unreported
    prisma.sessionBooking.count.mockResolvedValueOnce(0); // today
    prisma.coachAvailability.count.mockResolvedValue(5);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('ALL_GOOD');
    expect(step!.priority).toBe('low');
  });
});

// ─── getNextStep — ASSISTANTE ────────────────────────────────────────────────

describe('getNextStep — ASSISTANTE', () => {
  it('should return PROCESS_SUBSCRIPTIONS when pending subscriptions', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ASSISTANTE',
      parentProfile: null, student: null, coachProfile: null,
    });
    prisma.subscriptionRequest.count.mockResolvedValue(5);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('PROCESS_SUBSCRIPTIONS');
    expect(step!.priority).toBe('high');
  });

  it('should return PROCESS_PAYMENTS when pending payments', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ASSISTANTE',
      parentProfile: null, student: null, coachProfile: null,
    });
    prisma.subscriptionRequest.count.mockResolvedValue(0);
    prisma.payment.count.mockResolvedValue(3);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('PROCESS_PAYMENTS');
    expect(step!.priority).toBe('high');
  });

  it('should return ALL_CLEAR when nothing pending', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ASSISTANTE',
      parentProfile: null, student: null, coachProfile: null,
    });
    prisma.subscriptionRequest.count.mockResolvedValue(0);
    prisma.payment.count.mockResolvedValue(0);
    prisma.sessionBooking.count.mockResolvedValue(0);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('ALL_CLEAR');
    expect(step!.priority).toBe('low');
  });
});

// ─── getNextStep — ADMIN ─────────────────────────────────────────────────────

describe('getNextStep — ADMIN', () => {
  it('should return REVIEW_FAILED_PAYMENTS when failed payments exist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ADMIN',
      parentProfile: null, student: null, coachProfile: null,
    });
    prisma.user.count.mockResolvedValue(10);
    prisma.payment.count.mockResolvedValue(2);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('REVIEW_FAILED_PAYMENTS');
    expect(step!.priority).toBe('high');
  });

  it('should return VIEW_METRICS when no failed payments', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ADMIN',
      parentProfile: null, student: null, coachProfile: null,
    });
    prisma.user.count.mockResolvedValue(15);
    prisma.payment.count.mockResolvedValue(0);

    const step = await getNextStep('u1');
    expect(step!.type).toBe('VIEW_METRICS');
    expect(step!.priority).toBe('low');
    expect(step!.message).toContain('15');
  });
});
