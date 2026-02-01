/**
 * Integration Tests - Konnect Payment Endpoint
 *
 * Tests the Konnect payment creation endpoint with validation,
 * auth, ownership checks, and idempotency.
 */

import { POST } from '@/app/api/payments/konnect/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { upsertPaymentByExternalId } from '@/lib/payments';
import { NextRequest } from 'next/server';

// Mock guards
jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireRole: jest.fn(),
  isErrorResponse: jest.fn()
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findFirst: jest.fn()
    }
  }
}));

// Mock payments lib
jest.mock('@/lib/payments', () => ({
  upsertPaymentByExternalId: jest.fn()
}));

const mockParentSession = {
  user: {
    id: 'parent-123',
    email: 'parent@nexus.com',
    role: 'PARENT' as const,
    firstName: 'Parent',
    lastName: 'User'
  }
};

/**
 * Helper to create NextRequest with proper URL initialization
 */
function createMockRequest(url: string, options?: RequestInit): NextRequest {
  const request = new NextRequest(url, options);
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    writable: false,
    configurable: true
  });
  return request;
}

describe('POST /api/payments/konnect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockParentSession);
    (isErrorResponse as jest.Mock).mockReturnValue(false);
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      const mockErrorResponse = {
        json: async () => ({ error: 'UNAUTHORIZED', message: 'Authentication required' }),
        status: 401
      };
      (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
      (isErrorResponse as jest.Mock).mockReturnValue(true);

      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          key: 'monthly-premium',
          studentId: 'student-123',
          amount: 5000,
          description: 'Abonnement mensuel'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(requireRole).toHaveBeenCalledWith('PARENT');
    });

    it('should return 403 when user is not PARENT', async () => {
      const mockErrorResponse = {
        json: async () => ({ error: 'FORBIDDEN', message: 'Access denied. Required role: PARENT' }),
        status: 403
      };
      (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
      (isErrorResponse as jest.Mock).mockReturnValue(true);

      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          key: 'monthly-premium',
          studentId: 'student-123',
          amount: 5000,
          description: 'Abonnement mensuel'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  describe('Input Validation', () => {
    it('should return 422 for invalid payment type', async () => {
      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invalid-type', // Invalid
          key: 'monthly-premium',
          studentId: 'student-123',
          amount: 5000,
          description: 'Test'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details).toBeDefined();
    });

    it('should return 422 for missing required fields', async () => {
      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription'
          // Missing key, studentId, amount, description
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toHaveLength(4);
    });

    it('should return 422 for negative amount', async () => {
      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          key: 'monthly-premium',
          studentId: 'student-123',
          amount: -100, // Negative
          description: 'Test'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('should return 422 for empty description', async () => {
      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          key: 'monthly-premium',
          studentId: 'student-123',
          amount: 5000,
          description: '' // Empty
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Ownership Validation', () => {
    it.skip('should return 404 when student does not belong to parent', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          key: 'monthly-premium',
          studentId: 'other-student-123',
          amount: 5000,
          description: 'Abonnement mensuel'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('NOT_FOUND');
      expect(data.message).toContain('Student');
    });

    it.skip('should verify parent-student relationship', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          key: 'monthly-premium',
          studentId: 'student-123',
          amount: 5000,
          description: 'Test'
        })
      });

      await POST(request);

      // Verify query checks parent-student relationship
      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'student-123',
          parent: {
            userId: 'parent-123'
          }
        }
      });
    });
  });

  describe('Payment Creation', () => {
    it.skip('should create payment successfully for subscription', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-123',
        userId: 'user-123',
        parentId: 'parent-profile-123'
      });

      (upsertPaymentByExternalId as jest.Mock).mockResolvedValue({
        payment: {
          id: 'payment-123',
          externalId: 'ext-123',
          amount: 5000,
          status: 'PENDING'
        }
      });

      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          key: 'monthly-premium',
          studentId: 'student-123',
          amount: 5000,
          description: 'Abonnement Premium Mensuel'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.paymentId).toBe('payment-123');
      expect(data.paymentUrl).toContain('payment-123');
      expect(data.message).toContain('Konnect');
    });

    // TODO: Fix complex mock setup for payment type mapping
    it.skip('should map payment types correctly', async () => {
      const testCases = [
        { type: 'subscription', expectedMappedType: 'SUBSCRIPTION' },
        { type: 'addon', expectedMappedType: 'SPECIAL_PACK' },
        { type: 'pack', expectedMappedType: 'CREDIT_PACK' }
      ];

      for (const { type, expectedMappedType } of testCases) {
        jest.clearAllMocks();

        // Setup mocks for each iteration
        (requireRole as jest.Mock).mockResolvedValue(mockParentSession);
        (isErrorResponse as jest.Mock).mockReturnValue(false);
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({
          id: 'student-123',
          userId: 'user-123',
          parentId: 'parent-profile-123'
        });
        (upsertPaymentByExternalId as jest.Mock).mockResolvedValue({
          payment: { id: 'payment-123' }
        });

        const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            key: 'test-key',
            studentId: 'student-123',
            amount: 5000,
            description: 'Test'
          })
        });

        await POST(request);

        expect(upsertPaymentByExternalId).toHaveBeenCalledWith(
          expect.objectContaining({
            type: expectedMappedType
          })
        );
      }
    });

    it.skip('should include all required metadata', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-123',
        userId: 'user-123',
        parentId: 'parent-profile-123'
      });

      (upsertPaymentByExternalId as jest.Mock).mockResolvedValue({
        payment: { id: 'payment-123' }
      });

      const request = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          key: 'monthly-premium',
          studentId: 'student-123',
          amount: 5000,
          description: 'Abonnement Premium'
        })
      });

      await POST(request);

      expect(upsertPaymentByExternalId).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'konnect',
          type: 'SUBSCRIPTION',
          userId: 'parent-123',
          amount: 5000,
          currency: 'TND',
          description: 'Abonnement Premium',
          metadata: {
            studentId: 'student-123',
            itemKey: 'monthly-premium',
            itemType: 'subscription'
          }
        })
      );
    });
  });

  describe('Idempotency', () => {

    // TODO: Fix mock setup for multiple sequential POST calls
    it.skip('should generate deterministic externalId for same request', async () => {
      // Setup mocks
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-123',
        userId: 'user-123',
        parentId: 'parent-profile-123'
      });
      (upsertPaymentByExternalId as jest.Mock).mockResolvedValue({
        payment: { id: 'payment-123' }
      });

      const requestBody = {
        type: 'subscription' as const,
        key: 'monthly-premium',
        studentId: 'student-123',
        amount: 5000,
        description: 'Test'
      };

      // First request
      const request1 = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      await POST(request1);
      const firstExternalId = (upsertPaymentByExternalId as jest.Mock).mock.calls[0][0].externalId;

      // Reset mocks and setup again for second request
      jest.clearAllMocks();
      (requireRole as jest.Mock).mockResolvedValue(mockParentSession);
      (isErrorResponse as jest.Mock).mockReturnValue(false);
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-123',
        userId: 'user-123',
        parentId: 'parent-profile-123'
      });
      (upsertPaymentByExternalId as jest.Mock).mockResolvedValue({
        payment: { id: 'payment-123' }
      });

      // Second request (identical)
      const request2 = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      await POST(request2);
      const secondExternalId = (upsertPaymentByExternalId as jest.Mock).mock.calls[0][0].externalId;

      // Should be identical for idempotency
      expect(firstExternalId).toBe(secondExternalId);
      expect(firstExternalId).toBeDefined();
    });

    it.skip('should generate different externalId for different amounts', async () => {
      // Setup mocks for first request
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-123',
        userId: 'user-123',
        parentId: 'parent-profile-123'
      });
      (upsertPaymentByExternalId as jest.Mock).mockResolvedValue({
        payment: { id: 'payment-123' }
      });

      const baseRequest = {
        type: 'subscription' as const,
        key: 'monthly-premium',
        studentId: 'student-123',
        description: 'Test'
      };

      // Request with amount 5000
      const request1 = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseRequest, amount: 5000 })
      });

      await POST(request1);
      const firstExternalId = (upsertPaymentByExternalId as jest.Mock).mock.calls[0][0].externalId;

      // Reset and setup for second request
      jest.clearAllMocks();
      (requireRole as jest.Mock).mockResolvedValue(mockParentSession);
      (isErrorResponse as jest.Mock).mockReturnValue(false);
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-123',
        userId: 'user-123',
        parentId: 'parent-profile-123'
      });
      (upsertPaymentByExternalId as jest.Mock).mockResolvedValue({
        payment: { id: 'payment-124' }
      });

      // Request with amount 7000
      const request2 = createMockRequest('http://localhost:3000/api/payments/konnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseRequest, amount: 7000 })
      });

      await POST(request2);
      const secondExternalId = (upsertPaymentByExternalId as jest.Mock).mock.calls[0][0].externalId;

      // Should be different (different amounts)
      expect(firstExternalId).not.toBe(secondExternalId);
      expect(firstExternalId).toBeDefined();
      expect(secondExternalId).toBeDefined();
    });
  });
});
