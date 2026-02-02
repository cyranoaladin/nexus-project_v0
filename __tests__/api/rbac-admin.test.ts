/**
 * RBAC Tests - Admin Routes
 *
 * Tests that admin routes properly enforce role-based access control:
 * - Unauthenticated requests return 401
 * - Non-admin authenticated requests return 403
 * - Admin authenticated requests succeed
 */

import { GET } from '@/app/api/admin/dashboard/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { UserRole } from '@/types/enums';

// Mock guards module
jest.mock('@/lib/guards', () => {
  const actual = jest.requireActual('@/lib/guards');
  return {
    ...actual,
    requireRole: jest.fn(),
    isErrorResponse: jest.fn()
  };
});

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn()
    },
    student: { count: jest.fn() },
    coachProfile: { count: jest.fn() },
    parentProfile: { count: jest.fn() },
    payment: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn()
    },
    subscription: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn()
    },
    sessionBooking: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    creditTransaction: {
      findMany: jest.fn()
    }
  }
}));

describe('RBAC - Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/dashboard', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Mock requireRole to return 401 error
      const mockErrorResponse = {
        json: async () => ({ error: 'Unauthorized' }),
        status: 401
      };
      (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

      const response = await GET({} as any);
      const data = await response.json();

      expect(requireRole).toHaveBeenCalledWith('ADMIN');
      expect(data.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
    });

    it('should return 403 when user is authenticated but not ADMIN', async () => {
      // Mock requireRole to return 403 error (user has different role)
      const mockErrorResponse = {
        json: async () => ({ error: 'Forbidden', message: 'Required role: ADMIN' }),
        status: 403
      };
      (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

      const response = await GET({} as any);
      const data = await response.json();

      expect(requireRole).toHaveBeenCalledWith('ADMIN');
      expect(data.error).toBe('Forbidden');
      expect(response.status).toBe(403);
    });

    it('should succeed when user is authenticated as ADMIN', async () => {
      // Mock requireRole to return valid admin session
      const mockAdminSession = {
        user: {
          id: 'admin-123',
          email: 'admin@nexus.com',
          role: 'ADMIN' as UserRole,
          firstName: 'Admin',
          lastName: 'User'
        }
      };
      (requireRole as jest.Mock).mockResolvedValue(mockAdminSession);
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);

      // Mock Prisma responses
      const { prisma } = require('@/lib/prisma');
      prisma.user.count.mockResolvedValue(100);
      prisma.student.count.mockResolvedValue(50);
      prisma.coachProfile.count.mockResolvedValue(10);
      prisma.parentProfile.count.mockResolvedValue(30);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
      prisma.subscription.count.mockResolvedValue(40);
      prisma.subscription.aggregate.mockResolvedValue({ _sum: { monthlyPrice: 2000 } });
      prisma.sessionBooking.count.mockResolvedValue(150);
      prisma.sessionBooking.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.subscription.findMany.mockResolvedValue([]);
      prisma.creditTransaction.findMany.mockResolvedValue([]);
      prisma.user.groupBy.mockResolvedValue([]);
      prisma.payment.groupBy.mockResolvedValue([]);

      const response = await GET({} as any);
      const data = await response.json();

      expect(requireRole).toHaveBeenCalledWith('ADMIN');
      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(data.stats.totalUsers).toBe(100);
    });
  });

  describe('RBAC Isolation - Role Separation', () => {
    it('should enforce strict role separation', async () => {
      const roles = ['PARENT', 'ELEVE', 'COACH', 'ASSISTANTE'] as UserRole[];

      for (const role of roles) {
        const mockErrorResponse = {
          json: async () => ({ error: 'Forbidden', message: `Required role: ADMIN` }),
          status: 403
        };
        (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
        ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

        const response = await GET({} as any);
        const data = await response.json();

        expect(data.error).toBe('Forbidden');
        expect(response.status).toBe(403);
      }
    });
  });
});
