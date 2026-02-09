import { calculateCreditCost, checkCreditBalance, debitCredits, refundCredits } from '../../lib/credits';
import { prisma } from '../../lib/prisma';
import { ServiceType } from '../../types/enums';

// On utilise des spies typés au lieu de caster le client

describe('Credits System', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculateCreditCost', () => {
    it('should return 1 for a COURS_ONLINE', () => {
      const cost = calculateCreditCost('COURS_ONLINE' as ServiceType);
      expect(cost).toBe(1);
    });

    it('should return 1.25 for a presential course', () => {
      const cost = calculateCreditCost('COURS_PRESENTIEL' as ServiceType);
      expect(cost).toBe(1.25);
    });

    it('should return 1.5 for a group workshop', () => {
      const cost = calculateCreditCost('ATELIER_GROUPE' as ServiceType);
      expect(cost).toBe(1.5);
    });

    it('should return 1 for an unknown service type', () => {
      const cost = calculateCreditCost('UNKNOWN_TYPE' as ServiceType);
      expect(cost).toBe(1);
    });
  });

  describe('checkCreditBalance', () => {
    it('should return true when student has enough credits', async () => {
      const mockTransactions = [
        { amount: 5, expiresAt: null },
        { amount: -2, expiresAt: null },
        { amount: 3, expiresAt: new Date(Date.now() + 86400000) } // expires tomorrow
      ];

      jest.spyOn(prisma.creditTransaction, 'findMany').mockResolvedValue(mockTransactions as any);

      const result = await checkCreditBalance('student-123', 5);
      expect(result).toBe(true);
      expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith({
        where: {
          studentId: 'student-123',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } }
          ]
        }
      });
    });

    it('should return false when student has insufficient credits', async () => {
      const mockTransactions = [
        { amount: 2, expiresAt: null },
        { amount: -1, expiresAt: null }
      ];

      jest.spyOn(prisma.creditTransaction, 'findMany').mockResolvedValue(mockTransactions as any);

      const result = await checkCreditBalance('student-123', 5);
      expect(result).toBe(false);
    });

    it('should exclude expired credits from calculation', async () => {
      const mockTransactions = [
        { amount: 5, expiresAt: null },
        { amount: -2, expiresAt: null }
      ];

      jest.spyOn(prisma.creditTransaction, 'findMany').mockResolvedValue(mockTransactions as any);

      const result = await checkCreditBalance('student-123', 2);
      expect(result).toBe(true);
    });
  });

  describe('debitCredits', () => {
    it('should create a debit transaction with negative amount', async () => {
      const mockTransaction = {
        id: 'transaction-123',
        studentId: 'student-123',
        type: 'USAGE',
        amount: -1.25,
        description: 'Test session booking',
        sessionId: 'session-123'
      };

      // Mock findFirst to return null (no existing transaction)
      jest.spyOn(prisma.creditTransaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.creditTransaction, 'create').mockResolvedValue(mockTransaction as any);

      const result = await debitCredits('student-123', 1.25, 'session-123', 'Test session booking');

      // Function now returns { transaction, created }
      expect(result.transaction).toEqual(mockTransaction);
      expect(result.created).toBe(true);
      expect(prisma.creditTransaction.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-123',
          type: 'USAGE'
        }
      });
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          studentId: 'student-123',
          type: 'USAGE',
          amount: -1.25,
          description: 'Test session booking',
          sessionId: 'session-123'
        }
      });
    });

    it('should return existing transaction if already exists (idempotency)', async () => {
      jest.clearAllMocks();
      const mockExistingTransaction = {
        id: 'transaction-existing',
        studentId: 'student-123',
        type: 'USAGE',
        amount: -1.25,
        description: 'Test session booking',
        sessionId: 'session-123'
      };

      jest.spyOn(prisma.creditTransaction, 'findFirst').mockResolvedValue(mockExistingTransaction as any);

      const result = await debitCredits('student-123', 1.25, 'session-123', 'Test session booking');

      expect(result.transaction).toEqual(mockExistingTransaction);
      expect(result.created).toBe(false);
      expect(prisma.creditTransaction.findFirst).toHaveBeenCalled();
      // create should NOT be called
      expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('refundCredits', () => {
    it('should create a refund transaction with positive amount', async () => {
      const mockTransaction = {
        id: 'transaction-124',
        studentId: 'student-123',
        type: 'REFUND',
        amount: 1.25,
        description: 'Session cancellation refund',
        sessionId: 'session-123'
      };

      // Mock findFirst to return null (no existing refund)
      jest.spyOn(prisma.creditTransaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.creditTransaction, 'create').mockResolvedValue(mockTransaction as any);

      const result = await refundCredits('student-123', 1.25, 'session-123', 'Session cancellation refund');

      // Function now returns { transaction, created }
      expect(result.transaction).toEqual(mockTransaction);
      expect(result.created).toBe(true);
      expect(prisma.creditTransaction.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-123',
          type: 'REFUND'
        }
      });
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          studentId: 'student-123',
          type: 'REFUND',
          amount: 1.25,
          description: 'Session cancellation refund',
          sessionId: 'session-123'
        }
      });
    });

    it('should return existing refund if already exists (idempotency)', async () => {
      jest.clearAllMocks();
      const mockExistingRefund = {
        id: 'refund-existing',
        studentId: 'student-123',
        type: 'REFUND',
        amount: 1.25,
        description: 'Session cancellation refund',
        sessionId: 'session-123'
      };

      jest.spyOn(prisma.creditTransaction, 'findFirst').mockResolvedValue(mockExistingRefund as any);

      const result = await refundCredits('student-123', 1.25, 'session-123', 'Session cancellation refund');

      expect(result.transaction).toEqual(mockExistingRefund);
      expect(result.created).toBe(false);
      expect(prisma.creditTransaction.findFirst).toHaveBeenCalled();
      // create should NOT be called
      expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
    });
  });
});

describe('Credits System - Race Conditions & Additional', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('debitCredits - race condition (P2002)', () => {
    it('should return found transaction on P2002 unique constraint error', async () => {
      const mockFound = {
        id: 'tx-found',
        studentId: 'student-123',
        type: 'USAGE',
        amount: -1,
        sessionId: 'session-race',
      };

      jest.spyOn(prisma.creditTransaction, 'findFirst')
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce(mockFound as any); // after P2002

      jest.spyOn(prisma.creditTransaction, 'create').mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      );

      const result = await debitCredits('student-123', 1, 'session-race', 'test');
      expect(result.transaction).toEqual(mockFound);
      expect(result.created).toBe(false);
    });

    it('should rethrow non-P2002 errors', async () => {
      jest.spyOn(prisma.creditTransaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.creditTransaction, 'create').mockRejectedValue(new Error('DB down'));

      await expect(debitCredits('student-123', 1, 'session-err', 'test')).rejects.toThrow('DB down');
    });

    it('should rethrow P2002 if no transaction found after race', async () => {
      jest.spyOn(prisma.creditTransaction, 'findFirst')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      jest.spyOn(prisma.creditTransaction, 'create').mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      );

      await expect(debitCredits('student-123', 1, 'session-x', 'test')).rejects.toThrow();
    });
  });

  describe('refundCredits - race condition (P2002)', () => {
    it('should return found transaction on P2002 unique constraint error', async () => {
      const mockFound = {
        id: 'tx-refund-found',
        studentId: 'student-123',
        type: 'REFUND',
        amount: 1,
        sessionId: 'session-refund-race',
      };

      jest.spyOn(prisma.creditTransaction, 'findFirst')
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce(mockFound as any); // after P2002

      jest.spyOn(prisma.creditTransaction, 'create').mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      );

      const result = await refundCredits('student-123', 1, 'session-refund-race', 'test');
      expect(result.transaction).toEqual(mockFound);
      expect(result.created).toBe(false);
    });

    it('should rethrow non-P2002 errors', async () => {
      jest.spyOn(prisma.creditTransaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.creditTransaction, 'create').mockRejectedValue(new Error('Connection lost'));

      await expect(refundCredits('student-123', 1, 'session-err', 'test')).rejects.toThrow('Connection lost');
    });
  });

  describe('allocateMonthlyCredits', () => {
    it('should create a MONTHLY_ALLOCATION transaction with expiry', async () => {
      const { allocateMonthlyCredits } = require('@/lib/credits');
      const mockTx = { id: 'tx-monthly', type: 'MONTHLY_ALLOCATION', amount: 10 };
      jest.spyOn(prisma.creditTransaction, 'create').mockResolvedValue(mockTx as any);

      const result = await allocateMonthlyCredits('student-123', 10);
      expect(result).toEqual(mockTx);
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentId: 'student-123',
          type: 'MONTHLY_ALLOCATION',
          amount: 10,
          description: 'Allocation mensuelle de 10 crédits',
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  describe('expireOldCredits', () => {
    it('should create EXPIRATION transactions for expired credits', async () => {
      const { expireOldCredits } = require('@/lib/credits');
      const mockExpired = [
        { id: 'tx-1', studentId: 'student-1', amount: 5 },
        { id: 'tx-2', studentId: 'student-2', amount: 3 },
      ];
      (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue(mockExpired);
      (prisma.creditTransaction.create as jest.Mock).mockClear();
      const createMock = (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({});

      await expireOldCredits();

      expect(createMock).toHaveBeenCalledTimes(2);
      expect(createMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentId: 'student-1',
          type: 'EXPIRATION',
          amount: -5,
        }),
      });
    });

    it('should do nothing when no expired credits exist', async () => {
      const { expireOldCredits } = require('@/lib/credits');
      (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.creditTransaction.create as jest.Mock).mockClear();

      await expireOldCredits();

      expect(prisma.creditTransaction.create).toHaveBeenCalledTimes(0);
    });
  });
});

describe('Booking Cancellation Logic', () => {
  describe('canCancelBooking', () => {
    it('should return true if cancellation is 25 hours before an individual course', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-02T11:00:00Z'); // 25 hours later
      
      const result = canCancelBooking('INDIVIDUAL', 'IN_PERSON', sessionDate, now);
      expect(result).toBe(true);
    });

    it('should return false if cancellation is 23 hours before an individual course', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-02T09:00:00Z'); // 23 hours later
      
      const result = canCancelBooking('INDIVIDUAL', 'IN_PERSON', sessionDate, now);
      expect(result).toBe(false);
    });

    it('should return false if cancellation is 47 hours before a group workshop', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-03T09:00:00Z'); // 47 hours later
      
      const result = canCancelBooking('GROUP', 'IN_PERSON', sessionDate, now);
      expect(result).toBe(false);
    });

    it('should return true if cancellation is 49 hours before a group workshop', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-03T11:00:00Z'); // 49 hours later
      
      const result = canCancelBooking('GROUP', 'IN_PERSON', sessionDate, now);
      expect(result).toBe(true);
    });

    it('should return true if cancellation is 25 hours before an online course', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-02T11:00:00Z'); // 25 hours later
      
      const result = canCancelBooking('GROUP', 'ONLINE', sessionDate, now);
      expect(result).toBe(true); // ONLINE modality requires only 24h
    });

    it('should return true if cancellation is 25 hours before a hybrid course', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-02T11:00:00Z'); // 25 hours later
      
      const result = canCancelBooking('GROUP', 'HYBRID', sessionDate, now);
      expect(result).toBe(true); // HYBRID modality requires only 24h
    });

    it('should return true if cancellation is 49 hours before a masterclass', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-03T11:00:00Z'); // 49 hours later
      
      const result = canCancelBooking('MASTERCLASS', 'IN_PERSON', sessionDate, now);
      expect(result).toBe(true); // MASTERCLASS requires 48h
    });

    it('should return false if cancellation is 47 hours before a masterclass', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-03T09:00:00Z'); // 47 hours later
      
      const result = canCancelBooking('MASTERCLASS', 'IN_PERSON', sessionDate, now);
      expect(result).toBe(false);
    });

    it('should return false for unknown session type', () => {
      const { canCancelBooking } = require('@/lib/credits');
      
      const now = new Date('2024-01-01T10:00:00Z');
      const sessionDate = new Date('2024-01-10T10:00:00Z'); // far future
      
      const result = canCancelBooking('UNKNOWN_TYPE', 'IN_PERSON', sessionDate, now);
      expect(result).toBe(false); // default branch returns false
    });
  });
});
