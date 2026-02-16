/**
 * Unit tests for Next Step Engine (lib/next-step-engine.ts)
 *
 * Tests the recommendation logic for each role without hitting the database.
 * Prisma is mocked to return controlled data.
 */

import { UserRole } from '@/types/enums';

// Mock Prisma before importing the engine
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), count: jest.fn() },
    sessionBooking: { findFirst: jest.fn(), count: jest.fn() },
    diagnostic: { count: jest.fn() },
    coachAvailability: { count: jest.fn() },
    subscriptionRequest: { count: jest.fn() },
    payment: { count: jest.fn() },
  },
}));

import { getNextStep, type NextStep } from '@/lib/next-step-engine';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

beforeEach(() => {
  // Reset all mocks fully (clears implementations + call history)
  (mockPrisma.user.findUnique as jest.Mock).mockReset();
  ((mockPrisma.user as any).count as jest.Mock).mockReset();
  (mockPrisma.sessionBooking.findFirst as jest.Mock).mockReset();
  (mockPrisma.sessionBooking.count as jest.Mock).mockReset();
  (mockPrisma.diagnostic.count as jest.Mock).mockReset();
  (mockPrisma.coachAvailability.count as jest.Mock).mockReset();
  (mockPrisma.subscriptionRequest.count as jest.Mock).mockReset();
  (mockPrisma.payment.count as jest.Mock).mockReset();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockParentUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'parent-1',
    role: UserRole.PARENT,
    firstName: 'Marie',
    activatedAt: new Date(),
    parentProfile: {
      id: 'pp-1',
      children: [
        {
          id: 'student-1',
          credits: 5,
          completedSessions: 3,
          totalSessions: 5,
          subscriptions: [{ id: 'sub-1', planName: 'HYBRIDE' }],
        },
      ],
    },
    student: null,
    coachProfile: null,
    ...overrides,
  };
}

function mockEleveUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'eleve-1',
    role: UserRole.ELEVE,
    firstName: 'Lucas',
    activatedAt: new Date(),
    parentProfile: null,
    student: {
      id: 'st-1',
      credits: 3,
      completedSessions: 2,
      totalSessions: 4,
      subscriptions: [{ id: 'sub-1' }],
    },
    coachProfile: null,
    ...overrides,
  };
}

function mockCoachUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coach-1',
    role: UserRole.COACH,
    firstName: 'Hélios',
    activatedAt: new Date(),
    parentProfile: null,
    student: null,
    coachProfile: { id: 'cp-1' },
    ...overrides,
  };
}

function mockAdminUser() {
  return {
    id: 'admin-1',
    role: UserRole.ADMIN,
    firstName: 'Admin',
    activatedAt: new Date(),
    parentProfile: null,
    student: null,
    coachProfile: null,
  };
}

function mockAssistanteUser() {
  return {
    id: 'assist-1',
    role: UserRole.ASSISTANTE,
    firstName: 'Sarah',
    activatedAt: new Date(),
    parentProfile: null,
    student: null,
    coachProfile: null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Next Step Engine', () => {
  describe('getNextStep() — general', () => {
    it('should return null for unknown user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const step = await getNextStep('nonexistent');
      expect(step).toBeNull();
    });

    it('should return a NextStep object with required fields', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockParentUser({
          parentProfile: { id: 'pp-1', children: [] },
        })
      );
      const step = await getNextStep('parent-1');
      expect(step).not.toBeNull();
      expect(step).toHaveProperty('type');
      expect(step).toHaveProperty('message');
      expect(step).toHaveProperty('priority');
    });

    it('should handle errors gracefully and return null', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB down'));
      const step = await getNextStep('any-id');
      expect(step).toBeNull();
    });
  });

  describe('PARENT steps', () => {
    it('should recommend ADD_CHILD when parent has no children', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockParentUser({
          parentProfile: { id: 'pp-1', children: [] },
        })
      );
      const step = await getNextStep('parent-1');
      expect(step?.type).toBe('ADD_CHILD');
      expect(step?.priority).toBe('critical');
    });

    it('should recommend SUBSCRIBE when child has no active subscription', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockParentUser({
          parentProfile: {
            id: 'pp-1',
            children: [{
              id: 'st-1', credits: 0, completedSessions: 0,
              totalSessions: 0, subscriptions: [],
            }],
          },
        })
      );
      const step = await getNextStep('parent-1');
      expect(step?.type).toBe('SUBSCRIBE');
      expect(step?.priority).toBe('high');
    });

    it('should recommend BUY_CREDITS when credits are 0', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockParentUser({
          parentProfile: {
            id: 'pp-1',
            children: [{
              id: 'st-1', credits: 0, completedSessions: 1,
              totalSessions: 1, subscriptions: [{ id: 's1', planName: 'HYBRIDE' }],
            }],
          },
        })
      );
      const step = await getNextStep('parent-1');
      expect(step?.type).toBe('BUY_CREDITS');
      expect(step?.priority).toBe('high');
    });

    it('should recommend BOOK_SESSION when no upcoming session and no completed sessions', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockParentUser({
          parentProfile: {
            id: 'pp-1',
            children: [{
              id: 'st-1', credits: 5, completedSessions: 0,
              totalSessions: 0, subscriptions: [{ id: 's1', planName: 'HYBRIDE' }],
            }],
          },
        })
      );
      (mockPrisma.diagnostic.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

      const step = await getNextStep('parent-1');
      expect(step?.type).toBe('BOOK_SESSION');
    });

    it('should show UPCOMING_SESSION when session is scheduled', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockParentUser({
          parentProfile: {
            id: 'pp-1',
            children: [{
              id: 'st-1', credits: 5, completedSessions: 0,
              totalSessions: 0, subscriptions: [{ id: 's1', planName: 'HYBRIDE' }],
            }],
          },
        })
      );
      (mockPrisma.diagnostic.count as jest.Mock).mockResolvedValue(0);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      (mockPrisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({
        scheduledDate: futureDate,
      });

      const step = await getNextStep('parent-1');
      expect(step?.type).toBe('UPCOMING_SESSION');
      expect(step?.priority).toBe('medium');
    });

    it('should recommend VIEW_PROGRESS for active parent with sessions', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockParentUser());
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      (mockPrisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({
        scheduledDate: futureDate,
      });

      const step = await getNextStep('parent-1');
      expect(step?.type).toBe('VIEW_PROGRESS');
      expect(step?.priority).toBe('low');
    });
  });

  describe('ELEVE steps', () => {
    it('should show ACTIVATE_ACCOUNT when not activated', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockEleveUser({ activatedAt: null })
      );
      const step = await getNextStep('eleve-1');
      expect(step?.type).toBe('ACTIVATE_ACCOUNT');
      expect(step?.priority).toBe('critical');
    });

    it('should show WAIT_PARENT when no student profile', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockEleveUser({ student: null })
      );
      const step = await getNextStep('eleve-1');
      expect(step?.type).toBe('WAIT_PARENT');
      expect(step?.priority).toBe('high');
    });

    it('should show VIEW_SESSION when upcoming session exists', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockEleveUser());
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      (mockPrisma.sessionBooking.findFirst as jest.Mock).mockResolvedValueOnce({
        scheduledDate: futureDate,
        subject: 'MATHEMATIQUES',
      });

      const step = await getNextStep('eleve-1');
      expect(step?.type).toBe('VIEW_SESSION');
      expect(step?.message).toContain('MATHEMATIQUES');
    });

    it('should show EXPLORE_RESOURCES when no upcoming session', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockEleveUser());
      (mockPrisma.sessionBooking.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const step = await getNextStep('eleve-1');
      expect(step?.type).toBe('EXPLORE_RESOURCES');
      expect(step?.priority).toBe('low');
    });
  });

  describe('COACH steps', () => {
    it('should show COMPLETE_PROFILE when no coach profile', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockCoachUser({ coachProfile: null })
      );
      const step = await getNextStep('coach-1');
      expect(step?.type).toBe('COMPLETE_PROFILE');
      expect(step?.priority).toBe('critical');
    });

    it('should show SUBMIT_REPORT when unreported sessions exist', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockCoachUser());
      (mockPrisma.sessionBooking.count as jest.Mock)
        .mockResolvedValueOnce(3) // unreported
        .mockResolvedValueOnce(0); // today sessions

      const step = await getNextStep('coach-1');
      expect(step?.type).toBe('SUBMIT_REPORT');
      expect(step?.message).toContain('3');
      expect(step?.priority).toBe('high');
    });

    it('should show TODAY_SESSIONS when sessions are scheduled today', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockCoachUser());
      (mockPrisma.sessionBooking.count as jest.Mock)
        .mockResolvedValueOnce(0) // unreported
        .mockResolvedValueOnce(2); // today sessions

      const step = await getNextStep('coach-1');
      expect(step?.type).toBe('TODAY_SESSIONS');
      expect(step?.message).toContain('2');
    });

    it('should show SET_AVAILABILITY when no availability slots', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockCoachUser());
      (mockPrisma.sessionBooking.count as jest.Mock)
        .mockResolvedValueOnce(0)  // unreported sessions
        .mockResolvedValueOnce(0); // today sessions
      (mockPrisma.coachAvailability.count as jest.Mock).mockResolvedValueOnce(0);

      const step = await getNextStep('coach-1');
      expect(step?.type).toBe('SET_AVAILABILITY');
      expect(step?.priority).toBe('medium');
    });

    it('should show ALL_GOOD when everything is up to date', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockCoachUser());
      (mockPrisma.sessionBooking.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      (mockPrisma.coachAvailability.count as jest.Mock).mockResolvedValueOnce(5);

      const step = await getNextStep('coach-1');
      expect(step?.type).toBe('ALL_GOOD');
      expect(step?.priority).toBe('low');
    });
  });

  describe('ASSISTANTE steps', () => {
    it('should show PROCESS_SUBSCRIPTIONS when pending requests exist', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockAssistanteUser());
      (mockPrisma.subscriptionRequest.count as jest.Mock).mockResolvedValueOnce(4);

      const step = await getNextStep('assist-1');
      expect(step?.type).toBe('PROCESS_SUBSCRIPTIONS');
      expect(step?.message).toContain('4');
      expect(step?.priority).toBe('high');
    });

    it('should show PROCESS_PAYMENTS when pending payments exist', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockAssistanteUser());
      (mockPrisma.subscriptionRequest.count as jest.Mock).mockResolvedValueOnce(0);
      (mockPrisma.payment.count as jest.Mock).mockResolvedValueOnce(2);

      const step = await getNextStep('assist-1');
      expect(step?.type).toBe('PROCESS_PAYMENTS');
      expect(step?.message).toContain('2');
    });

    it('should show TODAY_SESSIONS when sessions are scheduled today', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockAssistanteUser());
      (mockPrisma.subscriptionRequest.count as jest.Mock).mockResolvedValueOnce(0);
      (mockPrisma.payment.count as jest.Mock).mockResolvedValueOnce(0);
      (mockPrisma.sessionBooking.count as jest.Mock).mockResolvedValueOnce(3);

      const step = await getNextStep('assist-1');
      expect(step?.type).toBe('TODAY_SESSIONS');
      expect(step?.message).toContain('3');
    });

    it('should show ALL_CLEAR when nothing pending', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockAssistanteUser());
      (mockPrisma.subscriptionRequest.count as jest.Mock).mockResolvedValueOnce(0);
      (mockPrisma.payment.count as jest.Mock).mockResolvedValueOnce(0);
      (mockPrisma.sessionBooking.count as jest.Mock).mockResolvedValueOnce(0);

      const step = await getNextStep('assist-1');
      expect(step?.type).toBe('ALL_CLEAR');
      expect(step?.priority).toBe('low');
    });
  });

  describe('ADMIN steps', () => {
    it('should show REVIEW_FAILED_PAYMENTS when failures exist', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockAdminUser());
      ((mockPrisma.user as any).count as jest.Mock).mockResolvedValueOnce(10); // new users this month
      (mockPrisma.payment.count as jest.Mock).mockResolvedValueOnce(3); // failed payments

      const step = await getNextStep('admin-1');
      expect(step?.type).toBe('REVIEW_FAILED_PAYMENTS');
      expect(step?.priority).toBe('high');
    });

    it('should show VIEW_METRICS when no failures', async () => {
      jest.clearAllMocks();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockAdminUser());
      ((mockPrisma.user as any).count as jest.Mock).mockResolvedValueOnce(12); // new users
      (mockPrisma.payment.count as jest.Mock).mockResolvedValueOnce(0); // no failed payments

      const step = await getNextStep('admin-1');
      expect(step?.type).toBe('VIEW_METRICS');
      expect(step?.priority).toBe('low');
    });
  });

  describe('NextStep shape validation', () => {
    const validPriorities = ['critical', 'high', 'medium', 'low'];

    it('every step should have a valid priority', async () => {
      // Test with parent
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockParentUser({ parentProfile: { id: 'pp-1', children: [] } })
      );
      const step = await getNextStep('parent-1');
      expect(step).not.toBeNull();
      expect(validPriorities).toContain(step!.priority);
    });

    it('every step should have a non-empty message', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockEleveUser({ activatedAt: null })
      );
      const step = await getNextStep('eleve-1');
      expect(step?.message.length).toBeGreaterThan(0);
    });

    it('every step should have a non-empty type', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockCoachUser());
      (mockPrisma.sessionBooking.count as jest.Mock).mockResolvedValue(0).mockResolvedValue(0);
      (mockPrisma.coachAvailability.count as jest.Mock).mockResolvedValue(5);

      const step = await getNextStep('coach-1');
      expect(step?.type.length).toBeGreaterThan(0);
    });
  });
});
