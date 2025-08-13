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

      jest.spyOn(prisma.creditTransaction, 'create').mockResolvedValue(mockTransaction as any);

      const result = await debitCredits('student-123', 1.25, 'session-123', 'Test session booking');

      expect(result).toEqual(mockTransaction);
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

      jest.spyOn(prisma.creditTransaction, 'create').mockResolvedValue(mockTransaction as any);

      const result = await refundCredits('student-123', 1.25, 'session-123', 'Session cancellation refund');

      expect(result).toEqual(mockTransaction);
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
  });
});

describe('Booking Cancellation Logic', () => {
  // Note: These tests would require implementation of canCancelBooking function
  // which doesn't exist yet in the credits.ts file
  describe('canCancelBooking', () => {
    it.skip('should return true if cancellation is 25 hours before a particular course', () => {
      // This test would be implemented once canCancelBooking function is created
    });

    it.skip('should return false if cancellation is 23 hours before a particular course', () => {
      // This test would be implemented once canCancelBooking function is created
    });

    it.skip('should return false if cancellation is 47 hours before a group workshop', () => {
      // This test would be implemented once canCancelBooking function is created
    });
  });
});
