import { calculateCreditCost, canCancelBooking, checkCreditBalance, debitCredits, refundCredits } from '../../lib/credits';
import { prisma } from '../../lib/prisma';
import { ServiceType } from '../../types/enums';

// Mock the prisma module
jest.mock('../../lib/prisma');

describe('Credits System', () => {
  let mockPrisma: jest.Mocked<typeof prisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      creditTransaction: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<typeof prisma>;
    jest.requireMock('../../lib/prisma').prisma = mockPrisma;
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

      (mockPrisma.creditTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions as any);

      const result = await checkCreditBalance('student-123', 5);
      expect(result).toBe(true);
      expect(mockPrisma.creditTransaction.findMany).toHaveBeenCalledWith({
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
        { amount: -1, expiresAt: null } // Solde = 1
      ];

      (mockPrisma.creditTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions as any);

      const result = await checkCreditBalance('student-123', 5); // Demande de 5 crédits
      expect(result).toBe(false);
    });

    it('should exclude expired credits from calculation', async () => {
      const mockTransactions = [
        { amount: 5, expiresAt: null },
        { amount: -2, expiresAt: null }
      ];

      (mockPrisma.creditTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions as any);

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

      // Configuration explicite du mock pour ce test
      (mockPrisma.creditTransaction.create as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await debitCredits('student-123', 1.25, 'session-123', 'Test session booking');

      expect(result).toEqual(mockTransaction);
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
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

      // Configuration explicite du mock pour ce test
      (mockPrisma.creditTransaction.create as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await refundCredits('student-123', 1.25, 'session-123', 'Session cancellation refund');

      expect(result).toEqual(mockTransaction);
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
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
  describe('canCancelBooking', () => {
    it('should return true if cancellation is 25 hours before a particular course', () => {
      const sessionDate = new Date(Date.now() + 25 * 60 * 60 * 1000); // Dans 25 heures
      const result = canCancelBooking(sessionDate, 'COURS_ONLINE' as ServiceType);
      expect(result).toBe(true);
    });

    it('should return false if cancellation is 23 hours before a particular course', () => {
      const sessionDate = new Date(Date.now() + 23 * 60 * 60 * 1000); // Dans 23 heures
      const result = canCancelBooking(sessionDate, 'COURS_PRESENTIEL' as ServiceType);
      expect(result).toBe(false);
    });

    it('should return true if cancellation is 49 hours before a group workshop', () => {
      const sessionDate = new Date(Date.now() + 49 * 60 * 60 * 1000); // Dans 49 heures
      const result = canCancelBooking(sessionDate, 'ATELIER_GROUPE' as ServiceType);
      expect(result).toBe(true);
    });

    it('should return false if cancellation is 47 hours before a group workshop', () => {
      const sessionDate = new Date(Date.now() + 47 * 60 * 60 * 1000); // Dans 47 heures
      const result = canCancelBooking(sessionDate, 'ATELIER_GROUPE' as ServiceType);
      expect(result).toBe(false);
    });
  });
});
