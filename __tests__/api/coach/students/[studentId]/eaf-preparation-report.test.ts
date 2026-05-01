import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/coach/students/[studentId]/eaf-preparation-report/route';
import { prisma } from '@/lib/prisma';

// Mock the guards module
jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(() => false),
}));

// Mock the coach-student-access module
jest.mock('@/lib/rbac/coach-student-access', () => ({
  assertCoachCanAccessStudent: jest.fn(),
  getCoachProfileForUser: jest.fn(),
  CoachNotAssignedError: class extends Error {
    constructor(message = "Vous n'êtes pas assigné à cet élève") {
      super(message);
      this.name = 'CoachNotAssignedError';
    }
  },
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    eafPreparationReport: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

// Type-safe mock
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('API /api/coach/students/[studentId]/eaf-preparation-report', () => {
  const mockCoachId = 'coach123';
  const mockStudentId = 'student123';
  const mockSession = {
    user: {
      id: 'user123',
      email: 'coach@test.com',
      role: 'COACH',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 403 if coach is not assigned to student', async () => {
      const { requireRole } = require('@/lib/guards');
      const { assertCoachCanAccessStudent } = require('@/lib/rbac/coach-student-access');
      
      requireRole.mockResolvedValue(mockSession);
      assertCoachCanAccessStudent.mockRejectedValue(new Error('Not assigned'));

      const request = new NextRequest('http://localhost:3000/api/coach/students/student123/eaf-preparation-report');
      const response = await GET(request, { params: Promise.resolve({ studentId: mockStudentId }) });

      expect(response.status).toBe(403);
    });

    it('should return the report if it exists', async () => {
      const { requireRole } = require('@/lib/guards');
      const { assertCoachCanAccessStudent, getCoachProfileForUser } = require('@/lib/rbac/coach-student-access');
      
      requireRole.mockResolvedValue(mockSession);
      assertCoachCanAccessStudent.mockResolvedValue(undefined);
      getCoachProfileForUser.mockResolvedValue({ id: mockCoachId });

      const mockReport = {
        id: 'report123',
        studentId: mockStudentId,
        coachId: mockCoachId,
        linearReading: 'Good',
        updatedAt: new Date(),
      };

      (prisma.eafPreparationReport.findUnique as jest.Mock).mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost:3000/api/coach/students/student123/eaf-preparation-report');
      const response = await GET(request, { params: Promise.resolve({ studentId: mockStudentId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report).toEqual(mockReport);
    });

    it('should return empty report if none exists', async () => {
      const { requireRole } = require('@/lib/guards');
      const { assertCoachCanAccessStudent, getCoachProfileForUser } = require('@/lib/rbac/coach-student-access');
      
      requireRole.mockResolvedValue(mockSession);
      assertCoachCanAccessStudent.mockResolvedValue(undefined);
      getCoachProfileForUser.mockResolvedValue({ id: mockCoachId });

      (prisma.eafPreparationReport.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/coach/students/student123/eaf-preparation-report');
      const response = await GET(request, { params: Promise.resolve({ studentId: mockStudentId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report).toBeNull();
    });
  });

  describe('PUT', () => {
    it('should return 403 if coach is not assigned to student', async () => {
      const { requireRole } = require('@/lib/guards');
      const { assertCoachCanAccessStudent } = require('@/lib/rbac/coach-student-access');
      
      requireRole.mockResolvedValue(mockSession);
      assertCoachCanAccessStudent.mockRejectedValue(new Error('Not assigned'));

      const request = new NextRequest('http://localhost:3000/api/coach/students/student123/eaf-preparation-report', {
        method: 'PUT',
        body: JSON.stringify({ linearReading: 'Good' }),
      });
      const response = await PUT(request, { params: Promise.resolve({ studentId: mockStudentId }) });

      expect(response.status).toBe(403);
    });

    it('should create a new report if none exists', async () => {
      const { requireRole } = require('@/lib/guards');
      const { assertCoachCanAccessStudent, getCoachProfileForUser } = require('@/lib/rbac/coach-student-access');
      
      requireRole.mockResolvedValue(mockSession);
      assertCoachCanAccessStudent.mockResolvedValue(undefined);
      getCoachProfileForUser.mockResolvedValue({ id: mockCoachId });

      const mockReport = {
        id: 'report123',
        studentId: mockStudentId,
        coachId: mockCoachId,
        linearReading: 'Good',
        updatedAt: new Date(),
      };

      (prisma.eafPreparationReport.upsert as jest.Mock).mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost:3000/api/coach/students/student123/eaf-preparation-report', {
        method: 'PUT',
        body: JSON.stringify({ linearReading: 'Good' }),
      });
      const response = await PUT(request, { params: Promise.resolve({ studentId: mockStudentId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report).toEqual(mockReport);
      expect((prisma.eafPreparationReport.upsert as jest.Mock)).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            studentId: mockStudentId,
            coachId: mockCoachId,
            linearReading: 'Good',
          }),
        })
      );
    });

    it('should update an existing report', async () => {
      const { requireRole } = require('@/lib/guards');
      const { assertCoachCanAccessStudent, getCoachProfileForUser } = require('@/lib/rbac/coach-student-access');
      
      requireRole.mockResolvedValue(mockSession);
      assertCoachCanAccessStudent.mockResolvedValue(undefined);
      getCoachProfileForUser.mockResolvedValue({ id: mockCoachId });

      const mockReport = {
        id: 'report123',
        studentId: mockStudentId,
        coachId: mockCoachId,
        linearReading: 'Good',
        updatedAt: new Date(),
      };

      (prisma.eafPreparationReport.upsert as jest.Mock).mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost:3000/api/coach/students/student123/eaf-preparation-report', {
        method: 'PUT',
        body: JSON.stringify({ linearReading: 'Good' }),
      });
      const response = await PUT(request, { params: Promise.resolve({ studentId: mockStudentId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should validate field length limits', async () => {
      const { requireRole } = require('@/lib/guards');
      const { assertCoachCanAccessStudent, getCoachProfileForUser } = require('@/lib/rbac/coach-student-access');
      
      requireRole.mockResolvedValue(mockSession);
      assertCoachCanAccessStudent.mockResolvedValue(undefined);
      getCoachProfileForUser.mockResolvedValue({ id: mockCoachId });

      const longText = 'a'.repeat(6000); // Exceeds 5000 char limit

      const request = new NextRequest('http://localhost:3000/api/coach/students/student123/eaf-preparation-report', {
        method: 'PUT',
        body: JSON.stringify({ linearReading: longText }),
      });
      const response = await PUT(request, { params: Promise.resolve({ studentId: mockStudentId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Bad Request');
    });
  });
});
