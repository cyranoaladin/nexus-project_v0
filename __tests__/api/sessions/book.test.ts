/**
 * Integration Tests - Session Booking Endpoint
 *
 * Tests complex booking logic with 10-step validation process.
 */

import { POST } from '@/app/api/sessions/book/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { requireFeatureApi } from '@/lib/access';

// Mock guards
jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn()
}));

// Mock rate limiting (always allow)
jest.mock('@/lib/middleware/rateLimit', () => ({
  RateLimitPresets: {
    expensive: jest.fn().mockReturnValue(null),
    standard: jest.fn().mockReturnValue(null),
    strict: jest.fn().mockReturnValue(null),
  },
}));

// Mock entitlement engine (for access guard)
jest.mock('@/lib/entitlement', () => ({
  getUserEntitlements: jest.fn().mockResolvedValue([
    { id: 'ent-1', productCode: 'PLATFORM', label: 'Platform', status: 'ACTIVE', startsAt: new Date(), endsAt: null, features: ['platform_access'] },
  ]),
}));

jest.mock('@/lib/access', () => ({
  ...jest.requireActual('@/lib/access'),
  requireFeatureApi: jest.fn(),
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
    sessionReminder: {
      createMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

const mockParentSession = {
  user: {
    id: 'cm4parent123def456ghi789jkl',
    email: 'parent@test.com',
    role: 'PARENT' as const,
    firstName: 'John',
    lastName: 'Doe'
  }
};

const mockStudentSession = {
  user: {
    id: 'cm4student123def456ghi789jk',
    email: 'student@test.com',
    role: 'ELEVE' as const,
    firstName: 'Jane',
    lastName: 'Doe'
  }
};

const validBookingData = {
  coachId: 'cm4coach123def456ghi789jklm',
  studentId: 'cm4stud456def789ghi012jklmn',
  subject: 'MATHEMATIQUES',
  scheduledDate: '2026-03-16', // Future weekday (Monday)
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
  const request = new NextRequest(url, options as any);
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
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);
    (requireFeatureApi as jest.Mock).mockResolvedValue(null);
    
    // Reset prisma.$transaction to prevent mock bleed between tests
    (prisma.$transaction as jest.Mock).mockReset();
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
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

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
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('should allow PARENT to book sessions', async () => {
      (requireAnyRole as jest.Mock).mockResolvedValue(mockParentSession);
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);
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
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);
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
      expect(response.status).toBe(422); // ZodError returns 422 for validation errors
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
      expect(response.status).toBe(422);
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

      expect(response.status).toBe(422);
      expect(data.message).toBe('Validation failed');
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
      expect(response.status).toBe(422);
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

      expect(response.status).toBe(422);
      expect(data.message).toBe('Validation failed');
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
      expect(response.status).toBe(422);
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
      expect(response.status).toBe(422);
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
      expect(response.status).toBe(422);
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

      expect(response.status).toBe(400);
      expect(data.message).toContain('3 months');
    });

    it('should return 400 for weekend booking (Saturday)', async () => {
      // Find a future Saturday using UTC-consistent arithmetic
      // (avoids local vs UTC day-of-week mismatch near midnight)
      const future = new Date(Date.now() + 14 * 86400000);
      future.setUTCDate(future.getUTCDate() + ((6 - future.getUTCDay() + 7) % 7));
      const dateStr = future.toISOString().split('T')[0];

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

      expect(response.status).toBe(400);
      expect(data.message).toContain('weekend');
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

      expect(response.status).toBe(400);
      expect(data.message).toContain('8:00 AM');
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

      expect(response.status).toBe(400);
      expect(data.message).toContain('8:00 AM');
    });
  });

  // ========================================
  // NOT FOUND TESTS (400)
  // ========================================

  describe('Not Found', () => {
    it('should return 400 when coach not found', async () => {
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

      expect(response.status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when coach does not teach subject', async () => {
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

      expect(response.status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when student not found', async () => {
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

      expect(response.status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });

  // ========================================
  // CONFLICT TESTS (409)
  // ========================================

  describe('Conflicts', () => {
    it('should return 409 when coach has conflicting session', async () => {
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
          parentProfile: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'parent-profile-123',
              userId: 'cm4parent123def456ghi789jkl'
            })
          },
          student: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'student-record-456',
              userId: 'cm4stud456def789ghi012jklmn',
              parentId: 'parent-profile-123'
            })
          },
          coachAvailability: {
            findFirst: jest.fn().mockResolvedValue({
              isRecurring: true,
              isAvailable: true,
              dayOfWeek: 1  // Monday
            })
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

      expect(response.status).toBe(409);
      expect(data.error).toBe('CONFLICT');
    });

    it('should return 400 when student has insufficient credits', async () => {
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
          parentProfile: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'parent-profile-123',
              userId: 'cm4parent123def456ghi789jkl'
            })
          },
          coachAvailability: {
            findFirst: jest.fn().mockResolvedValue({
              isRecurring: true,
              isAvailable: true,
              dayOfWeek: 1  // Monday
            })
          },
          sessionBooking: {
            findFirst: jest.fn().mockResolvedValue(null)
          },
          student: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 'student-record-456', userId: 'cm4stud456def789ghi012jklmn', parentId: 'parent-profile-123' })
              .mockResolvedValueOnce({ id: 'student-record-456' })
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

      expect(response.status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });

  // ========================================
  // SUCCESS TESTS (201)
  // ========================================

  describe('Success', () => {
    it('should successfully book session as PARENT', async () => {
      (requireAnyRole as jest.Mock).mockResolvedValue(mockParentSession);
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);

      const mockBooking = {
        id: 'booking-123',
        coachId: 'cm4coach123def456ghi789jklm',
        studentId: 'cm4stud456def789ghi012jklmn',
        subject: 'MATHEMATIQUES',
        status: 'SCHEDULED',
        scheduledDate: new Date('2026-03-16'),
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        creditsUsed: 1,
        student: { id: 'student-456', firstName: 'Jane', lastName: 'Doe' },
        coach: { id: 'coach-123', firstName: 'Coach', lastName: 'Test' },
        parent: { id: 'parent-123', firstName: 'John', lastName: 'Doe' }
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: Function) => {
        const mockTx = {
          coachProfile: {
            findFirst: jest.fn().mockResolvedValue({
              userId: 'cm4coach123def456ghi789jklm',
              subjects: ['MATHEMATIQUES'],
              user: { id: 'cm4coach123def456ghi789jklm', role: 'COACH', firstName: 'Coach', lastName: 'Test' }
            })
          },
          user: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'cm4stud456def789ghi012jklmn',
              role: 'ELEVE',
              firstName: 'Jane',
              lastName: 'Doe'
            }),
            findMany: jest.fn().mockResolvedValue([]) // Assistants
          },
          parentProfile: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'parent-profile-123',
              userId: 'cm4parent123def456ghi789jkl'
            })
          },
          student: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 'student-record-456', userId: 'cm4stud456def789ghi012jklmn', parentId: 'parent-profile-123' })
              .mockResolvedValueOnce({ id: 'student-record-456', userId: 'cm4stud456def789ghi012jklmn' })
          },
          coachAvailability: {
            findFirst: jest.fn().mockResolvedValue({
              isRecurring: true,
              isAvailable: true,
              dayOfWeek: 1  // Monday
            })
          },
          sessionBooking: {
            findFirst: jest.fn().mockResolvedValue(null),  // No conflicts (coach + student)
            create: jest.fn().mockResolvedValue(mockBooking)
          },
          creditTransaction: {
            findMany: jest.fn().mockResolvedValue([
              { amount: 10, expiresAt: null }  // Sufficient credits
            ]),
            findFirst: jest.fn().mockResolvedValue(null), // No existing USAGE
            create: jest.fn().mockResolvedValue({
              id: 'tx-123',
              studentId: 'student-record-456',
              amount: -1,
              type: 'USAGE'
            })
          },
          sessionNotification: {
            createMany: jest.fn().mockResolvedValue({ count: 1 })
          },
          sessionReminder: {
            createMany: jest.fn().mockResolvedValue({ count: 3 })
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

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('booking-123');
      expect(data.message).toContain('successfully');
    });

    it('should successfully book session as ELEVE', async () => {
      (requireAnyRole as jest.Mock).mockResolvedValue(mockStudentSession);
      ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);

      const mockBooking = {
        id: 'booking-456',
        status: 'SCHEDULED',
        coachId: 'cm4coach123def456ghi789jklm',
        studentId: 'cm4student123def456ghi789jk',
        student: { id: 'student-123', firstName: 'Jane', lastName: 'Doe' },
        coach: { id: 'coach-123', firstName: 'Coach', lastName: 'Test' },
        parent: null
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: Function) => {
        const mockTx = {
          coachProfile: {
            findFirst: jest.fn().mockResolvedValue({
              userId: 'cm4coach123def456ghi789jklm',
              subjects: ['MATHEMATIQUES'],
              user: { id: 'cm4coach123def456ghi789jklm', role: 'COACH', firstName: 'Coach', lastName: 'Test' }
            })
          },
          user: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'cm4student123def456ghi789jk',
              role: 'ELEVE',
              firstName: 'Jane',
              lastName: 'Doe'
            }),
            findMany: jest.fn().mockResolvedValue([])
          },
          student: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 'student-record-123', userId: 'cm4student123def456ghi789jk' })
              .mockResolvedValueOnce({ id: 'student-record-123', userId: 'cm4student123def456ghi789jk' })
          },
          coachAvailability: {
            findFirst: jest.fn().mockResolvedValue({
              isRecurring: true,
              isAvailable: true,
              dayOfWeek: 1
            })
          },
          sessionBooking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockBooking)
          },
          creditTransaction: {
            findMany: jest.fn().mockResolvedValue([
              { amount: 10, expiresAt: null }
            ]),
            findFirst: jest.fn().mockResolvedValue(null), // No existing USAGE
            create: jest.fn().mockResolvedValue({
              id: 'tx-456',
              studentId: 'student-record-123',
              amount: -1,
              type: 'USAGE'
            })
          },
          sessionNotification: {
            createMany: jest.fn().mockResolvedValue({ count: 1 })
          },
          sessionReminder: {
            createMany: jest.fn().mockResolvedValue({ count: 3 })
          }
        };
        return callback(mockTx);
      });

      const studentBookingData = {
        ...validBookingData,
        studentId: 'cm4student123def456ghi789jk' // Same as session user
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
      const mockCreditCreate = jest.fn().mockResolvedValue({
        id: 'tx-789',
        studentId: 'student-record-789',
        amount: -1,
        type: 'USAGE'
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: Function) => {
        const mockTx = {
          coachProfile: {
            findFirst: jest.fn().mockResolvedValue({
              userId: 'cm4coach123def456ghi789jklm',
              subjects: ['MATHEMATIQUES'],
              user: { id: 'cm4coach123def456ghi789jklm', role: 'COACH', firstName: 'C', lastName: 'T' }
            })
          },
          user: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'cm4stud456def789ghi012jklmn',
              role: 'ELEVE',
              firstName: 'S',
              lastName: 'T'
            }),
            findMany: jest.fn().mockResolvedValue([])
          },
          parentProfile: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'parent-profile-789',
              userId: 'cm4parent123def456ghi789jkl'
            })
          },
          student: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 'student-record-789', userId: 'cm4stud456def789ghi012jklmn', parentId: 'parent-profile-789' })
              .mockResolvedValueOnce({ id: 'student-record-789', userId: 'cm4stud456def789ghi012jklmn' })
          },
          coachAvailability: {
            findFirst: jest.fn().mockResolvedValue({
              isRecurring: true,
              isAvailable: true,
              dayOfWeek: 1
            })
          },
          sessionBooking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'booking-789',
              status: 'SCHEDULED',
              student: { id: 'student-789', firstName: 'S', lastName: 'T' },
              coach: { id: 'coach-789', firstName: 'C', lastName: 'T' },
              parent: { id: 'parent-789', firstName: 'P', lastName: 'T' }
            })
          },
          creditTransaction: {
            findMany: jest.fn().mockResolvedValue([
              { amount: 10, expiresAt: null }
            ]),
            findFirst: jest.fn().mockResolvedValue(null), // No existing USAGE
            create: mockCreditCreate
          },
          sessionNotification: {
            createMany: jest.fn().mockResolvedValue({ count: 1 })
          },
          sessionReminder: {
            createMany: jest.fn().mockResolvedValue({ count: 3 })
          }
        };
        return callback(mockTx);
      });

      const request = createMockRequest('http://localhost/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify(validBookingData)
      });

      await POST(request);

      expect(mockCreditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentId: 'student-record-789',
          type: 'USAGE',
          amount: -1
        })
      });
    });
  });
});
