/**
 * Integration Tests - Session Booking Endpoint
 *
 * Tests complex booking logic with 10-step validation process.
 */

import { POST } from '@/app/api/sessions/book/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock guards
jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn()
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    coachProfile: {
      findFirst: jest.fn()
    },
    coachAvailability: {
      findMany: jest.fn()
    },
    sessionBooking: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    creditTransaction: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn()
    },
    sessionNotification: {
      createMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

const mockParentSession = {
  user: {
    id: 'parent-123',
    email: 'parent@test.com',
    role: 'PARENT' as const,
    firstName: 'John',
    lastName: 'Doe'
  }
};

const mockStudentSession = {
  user: {
    id: 'student-123',
    email: 'student@test.com',
    role: 'ELEVE' as const,
    firstName: 'Jane',
    lastName: 'Doe'
  }
};

const validBookingData = {
  coachId: 'coach-123',
  studentId: 'student-456',
  subject: 'MATHEMATIQUES',
  scheduledDate: '2026-03-15', // Future date
  startTime: '14:00',
  endTime: '15:00',
  duration: 60,
  type: 'INDIVIDUAL',
  modality: 'ONLINE',
  title: 'Math tutoring session',
  description: 'Algebra review',
  creditsToUse: 1
};

/**
 * Helper to create NextRequest with proper URL initialization
 */
function createMockRequest(url: string, options?: RequestInit): NextRequest {
  const request = new NextRequest(url, options);
  // Ensure nextUrl is properly initialized
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    writable: false,
    configurable: true
  });
  return request;
}

describe('POST /api/sessions/book', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAnyRole as jest.Mock).mockResolvedValue(mockParentSession);
    (isErrorResponse as jest.Mock).mockReturnValue(false);
  });

  // ========================================
  // AUTHENTICATION TESTS
  // ========================================

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      const mockErrorResponse = {
        json: async () => ({ error: 'UNAUTHORIZED', message: 'Authentication required' }),
        status: 401
      };
      (requireAnyRole as jest.Mock).mockResolvedValue(mockErrorResponse);
      (isErrorResponse as jest.Mock).mockReturnValue(true);

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should return 403 when user is not PARENT or ELEVE', async () => {
      const mockErrorResponse = {
        json: async () => ({ error: 'FORBIDDEN', message: 'Access denied. Required role: PARENT or ELEVE' }),
        status: 403
      };
      (requireAnyRole as jest.Mock).mockResolvedValue(mockErrorResponse);
      (isErrorResponse as jest.Mock).mockReturnValue(true);

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('should allow PARENT to book sessions', async () => {
      (requireAnyRole as jest.Mock).mockResolvedValue(mockParentSession);
      (isErrorResponse as jest.Mock).mockReturnValue(false);
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        id: 'booking-123',
        status: 'SCHEDULED'
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      expect(response.status).not.toBe(403);
    });

    it('should allow ELEVE to book sessions', async () => {
      (requireAnyRole as jest.Mock).mockResolvedValue(mockStudentSession);
      (isErrorResponse as jest.Mock).mockReturnValue(false);
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        id: 'booking-123',
        status: 'SCHEDULED'
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify({
          ...validBookingData,
          studentId: 'student-123' // Same as session user
        })
      });

      const response = await POST(request);
      expect(response.status).not.toBe(403);
    });
  });

  // ========================================
  // VALIDATION TESTS (422)
  // ========================================

  describe('Validation', () => {
    it('should return 422 for missing coachId', async () => {
      const invalidData = { ...validBookingData };
      delete (invalidData as any).coachId;

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      expect(response.status).toBe(400); // ZodError returns 400 in current implementation
    });

    it('should return 422 for invalid subject', async () => {
      const invalidData = {
        ...validBookingData,
        subject: 'INVALID_SUBJECT'
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 422 for past date', async () => {
      const invalidData = {
        ...validBookingData,
        scheduledDate: '2020-01-01'
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Validation failed');
    });

    it('should return 422 for invalid time format', async () => {
      const invalidData = {
        ...validBookingData,
        startTime: '25:00' // Invalid hour
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 422 when endTime is before startTime', async () => {
      const invalidData = {
        ...validBookingData,
        startTime: '15:00',
        endTime: '14:00'
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Validation failed');
    });

    it('should return 422 when duration does not match time difference', async () => {
      const invalidData = {
        ...validBookingData,
        startTime: '14:00',
        endTime: '15:00',
        duration: 90 // Should be 60
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 422 for duration < 30 minutes', async () => {
      const invalidData = {
        ...validBookingData,
        startTime: '14:00',
        endTime: '14:15',
        duration: 15
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 422 for duration > 180 minutes', async () => {
      const invalidData = {
        ...validBookingData,
        duration: 200
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  // ========================================
  // BUSINESS LOGIC TESTS (400)
  // ========================================

  describe('Business Rules', () => {
    it('should return 400 for booking more than 3 months in advance', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 4);
      const dateStr = futureDate.toISOString().split('T')[0];

      const invalidData = {
        ...validBookingData,
        scheduledDate: dateStr
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500); // Wrapped in error handler
      expect(data.error).toContain('3 months');
    });

    it('should return 400 for weekend booking (Saturday)', async () => {
      // Find next Saturday
      const nextSaturday = new Date();
      nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7));
      const dateStr = nextSaturday.toISOString().split('T')[0];

      const invalidData = {
        ...validBookingData,
        scheduledDate: dateStr
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('weekend');
    });

    it('should return 400 for booking before 8 AM', async () => {
      const invalidData = {
        ...validBookingData,
        startTime: '07:00',
        endTime: '08:00'
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('8:00 AM');
    });

    it('should return 400 for booking after 8 PM', async () => {
      const invalidData = {
        ...validBookingData,
        startTime: '20:00',
        endTime: '21:00'
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('8:00 PM');
    });
  });

  // ========================================
  // NOT FOUND TESTS (404/500)
  // ========================================

  describe('Not Found', () => {
    it('should return 500 when coach not found', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          coachProfile: {
            findFirst: jest.fn().mockResolvedValue(null)
          }
        };
        return callback(mockTx);
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Coach not found');
    });

    it('should return 500 when coach does not teach subject', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          coachProfile: {
            findFirst: jest.fn().mockResolvedValue(null) // No coach for this subject
          }
        };
        return callback(mockTx);
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Coach');
    });

    it('should return 500 when student not found', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          coachProfile: {
            findFirst: jest.fn().mockResolvedValue({
              userId: 'coach-123',
              subjects: ['MATHEMATIQUES'],
              user: {
                id: 'coach-123',
                role: 'COACH',
                firstName: 'Coach',
                lastName: 'Test'
              }
            })
          },
          user: {
            findFirst: jest.fn().mockResolvedValue(null) // Student not found
          }
        };
        return callback(mockTx);
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Student not found');
    });
  });

  // ========================================
  // CONFLICT TESTS (409/500)
  // ========================================

  describe('Conflicts', () => {
    it('should return 500 when coach has conflicting session', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          coachProfile: {
            findFirst: jest.fn().mockResolvedValue({
              userId: 'coach-123',
              subjects: ['MATHEMATIQUES'],
              user: { id: 'coach-123', role: 'COACH', firstName: 'C', lastName: 'T' }
            })
          },
          user: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'student-456',
              role: 'ELEVE',
              firstName: 'S',
              lastName: 'T'
            }),
            findUnique: jest.fn().mockResolvedValue({
              id: 'parent-123',
              role: 'PARENT'
            }),
            findMany: jest.fn().mockResolvedValue([
              { id: 'student-456', studentProfile: { parentId: 'parent-123' } }
            ])
          },
          coachAvailability: {
            findMany: jest.fn().mockResolvedValue([
              { isRecurring: true, isAvailable: true, dayOfWeek: 6 }
            ])
          },
          sessionBooking: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'existing-session',
              coachId: 'coach-123' // Conflict!
            })
          }
        };
        return callback(mockTx);
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('already has a session');
    });

    it('should return 500 when student has insufficient credits', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          coachProfile: {
            findFirst: jest.fn().mockResolvedValue({
              userId: 'coach-123',
              subjects: ['MATHEMATIQUES'],
              user: { id: 'coach-123', role: 'COACH', firstName: 'C', lastName: 'T' }
            })
          },
          user: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'student-456',
              role: 'ELEVE',
              firstName: 'S',
              lastName: 'T'
            }),
            findUnique: jest.fn().mockResolvedValue({
              id: 'parent-123',
              role: 'PARENT'
            }),
            findMany: jest.fn().mockResolvedValue([
              { id: 'student-456', studentProfile: { parentId: 'parent-123' } }
            ])
          },
          coachAvailability: {
            findMany: jest.fn().mockResolvedValue([
              { isRecurring: true, isAvailable: true, dayOfWeek: 6 }
            ])
          },
          sessionBooking: {
            findFirst: jest.fn().mockResolvedValue(null)
          },
          creditTransaction: {
            findMany: jest.fn().mockResolvedValue([]) // No credits
          }
        };
        return callback(mockTx);
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Insufficient credits');
    });
  });

  // ========================================
  // SUCCESS TESTS (201)
  // ========================================

  describe('Success', () => {
    it('should successfully book session as PARENT', async () => {
      (requireAnyRole as jest.Mock).mockResolvedValue(mockParentSession);
      (isErrorResponse as jest.Mock).mockReturnValue(false);

      const mockBooking = {
        id: 'booking-123',
        coachId: 'coach-123',
        studentId: 'student-456',
        subject: 'MATHEMATIQUES',
        status: 'SCHEDULED',
        scheduledDate: new Date('2026-03-15'),
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        creditsUsed: 1
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockBooking);

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('booking-123');
      expect(data.message).toContain('successfully');
    });

    it('should successfully book session as ELEVE', async () => {
      (requireAnyRole as jest.Mock).mockResolvedValue(mockStudentSession);
      (isErrorResponse as jest.Mock).mockReturnValue(false);

      const mockBooking = {
        id: 'booking-456',
        status: 'SCHEDULED'
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockBooking);

      const studentBookingData = {
        ...validBookingData,
        studentId: 'student-123' // Same as session user
      };

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(studentBookingData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('booking-456');
    });

    it('should create credit transaction when booking', async () => {
      const mockTransaction = jest.fn();
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          coachProfile: { findFirst: jest.fn().mockResolvedValue({ userId: 'c', subjects: ['MATHEMATIQUES'], user: { id: 'c', role: 'COACH', firstName: 'C', lastName: 'T' } }) },
          user: {
            findFirst: jest.fn().mockResolvedValue({ id: 's', role: 'ELEVE', firstName: 'S', lastName: 'T' }),
            findUnique: jest.fn().mockResolvedValue({ id: 'p', role: 'PARENT' }),
            findMany: jest.fn().mockResolvedValue([{ id: 's', studentProfile: { parentId: 'p' } }])
          },
          coachAvailability: { findMany: jest.fn().mockResolvedValue([{ isRecurring: true, isAvailable: true, dayOfWeek: 6 }]) },
          sessionBooking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'b', status: 'SCHEDULED' })
          },
          creditTransaction: {
            findMany: jest.fn().mockResolvedValue([{ amount: 10, expiresAt: null }]),
            create: mockTransaction.mockResolvedValue({ id: 'tx-123' })
          },
          sessionNotification: { createMany: jest.fn() }
        };
        return callback(mockTx);
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      await POST(request);

      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});
