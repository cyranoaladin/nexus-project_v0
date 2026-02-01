/**
 * Unit Tests - Auth Guards
 *
 * Tests the centralized auth guard functions:
 * - requireAuth()
 * - requireRole()
 * - requireAnyRole()
 * - isOwner()
 * - isStaff()
 */

import { requireAuth, requireRole, requireAnyRole, isOwner, isStaff, isErrorResponse, AuthSession } from '@/lib/guards';
import { UserRole } from '@/types/enums';
import { getServerSession } from 'next-auth';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: jest.fn().mockResolvedValue(body),
      status: init?.status || 200,
      headers: new Map()
    }))
  }
}));

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

// Mock authOptions
jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

describe('Auth Guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireAuth()', () => {
    it('should return session when user is authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'ELEVE' as UserRole,
          firstName: 'Test',
          lastName: 'User'
        }
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await requireAuth();

      expect(result).toEqual(mockSession);
      expect(isErrorResponse(result)).toBe(false);
    });

    it('should return 401 when user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const result = await requireAuth();

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        const data = await result.json();
        expect(data.error).toBe('Unauthorized');
        expect(result.status).toBe(401);
      }
    });

    it('should return 401 when session is invalid (missing id or role)', async () => {
      const invalidSession = {
        user: {
          email: 'test@example.com'
          // Missing id and role
        }
      };
      (getServerSession as jest.Mock).mockResolvedValue(invalidSession);

      const result = await requireAuth();

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        const data = await result.json();
        expect(data.error).toBe('Unauthorized');
        expect(data.message).toBe('Invalid session');
      }
    });
  });

  describe('requireRole()', () => {
    it('should return session when user has required role', async () => {
      const mockSession = {
        user: {
          id: 'admin-123',
          email: 'admin@example.com',
          role: 'ADMIN' as UserRole,
          firstName: 'Admin',
          lastName: 'User'
        }
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await requireRole('ADMIN');

      expect(result).toEqual(mockSession);
      expect(isErrorResponse(result)).toBe(false);
    });

    it('should return 403 when user has different role', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          role: 'ELEVE' as UserRole
        }
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await requireRole('ADMIN');

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        const data = await result.json();
        expect(data.error).toBe('Forbidden');
        expect(result.status).toBe(403);
      }
    });

    it('should return 401 when user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const result = await requireRole('ADMIN');

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.status).toBe(401);
      }
    });
  });

  describe('requireAnyRole()', () => {
    it('should return session when user has one of allowed roles', async () => {
      const mockSession = {
        user: {
          id: 'assist-123',
          email: 'assist@example.com',
          role: 'ASSISTANTE' as UserRole
        }
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE']);

      expect(result).toEqual(mockSession);
      expect(isErrorResponse(result)).toBe(false);
    });

    it('should return 403 when user has none of allowed roles', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          role: 'ELEVE' as UserRole
        }
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE']);

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        const data = await result.json();
        expect(data.error).toBe('Forbidden');
        expect(result.status).toBe(403);
      }
    });
  });

  describe('isOwner()', () => {
    const mockSession: AuthSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'ELEVE' as UserRole
      }
    };

    it('should return true when session user matches userId', () => {
      expect(isOwner(mockSession, 'user-123')).toBe(true);
    });

    it('should return false when session user does not match userId', () => {
      expect(isOwner(mockSession, 'other-user')).toBe(false);
    });
  });

  describe('isStaff()', () => {
    it('should return true for ADMIN role', () => {
      const adminSession: AuthSession = {
        user: { id: '1', email: 'admin@test.com', role: 'ADMIN' as UserRole }
      };
      expect(isStaff(adminSession)).toBe(true);
    });

    it('should return true for ASSISTANTE role', () => {
      const assistSession: AuthSession = {
        user: { id: '1', email: 'assist@test.com', role: 'ASSISTANTE' as UserRole }
      };
      expect(isStaff(assistSession)).toBe(true);
    });

    it('should return false for other roles', () => {
      const userSession: AuthSession = {
        user: { id: '1', email: 'user@test.com', role: 'ELEVE' as UserRole }
      };
      expect(isStaff(userSession)).toBe(false);
    });
  });

  describe('isErrorResponse()', () => {
    it('should identify error responses from guards', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const result = await requireAuth();

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        const data = await result.json();
        expect(data.error).toBe('Unauthorized');
      }
    });

    it('should identify successful session responses', async () => {
      const mockSession = {
        user: {
          id: '1',
          email: 'test@test.com',
          role: 'ELEVE' as UserRole
        }
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await requireAuth();

      expect(isErrorResponse(result)).toBe(false);
      expect((result as AuthSession).user.id).toBe('1');
    });
  });
});
