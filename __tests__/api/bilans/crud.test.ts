/**
 * F50: Bilans API CRUD Tests
 * Tests for GET/POST /api/bilans
 */

import { GET, POST } from '@/app/api/bilans/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn((roles: string[]) => {
    // Return a function that will be called with request
    return Promise.resolve({ user: { id: 'admin-1', role: 'ADMIN' } });
  }),
  isErrorResponse: jest.fn((val: unknown) => {
    return val instanceof Response && val.status !== 200;
  }),
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilan: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  bilan: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
  };
};

// Mock requireAnyRole to return proper structure
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(() => Promise.resolve({ user: { id: 'admin-1', role: 'ADMIN' } })),
  isErrorResponse: jest.fn((val: unknown) => false),
}));

describe('F50: /api/bilans CRUD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/bilans', () => {
    it('should return list of bilans with pagination', async () => {
      const mockBilans = [
        {
          id: 'bilan-1',
          type: 'DIAGNOSTIC_PRE_STAGE',
          subject: 'MATHS',
          studentName: 'Jean Dupont',
          studentEmail: 'jean@example.com',
          status: 'COMPLETED',
          globalScore: 75,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          student: { id: 'stu-1', user: { firstName: 'Jean', lastName: 'Dupont' } },
          stage: null,
          coach: null,
        },
      ];

      mockPrisma.bilan.findMany.mockResolvedValue(mockBilans);
      mockPrisma.bilan.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/bilans?limit=10&offset=0');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('bilan-1');
      expect(body.pagination.total).toBe(1);
      expect(body.pagination.limit).toBe(10);
    });

    it('should filter by type and status', async () => {
      mockPrisma.bilan.findMany.mockResolvedValue([]);
      mockPrisma.bilan.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/bilans?type=DIAGNOSTIC_PRE_STAGE&status=COMPLETED');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockPrisma.bilan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'DIAGNOSTIC_PRE_STAGE',
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.bilan.findMany.mockRejectedValue(new Error('DB error'));

      const request = new NextRequest('http://localhost:3000/api/bilans');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Failed');
    });
  });

  describe('POST /api/bilans', () => {
    it('should create a new bilan', async () => {
      const mockBilan = {
        id: 'new-bilan-123',
        type: 'ASSESSMENT_QCM',
        subject: 'NSI',
        studentName: 'Marie Curie',
        studentEmail: 'marie@example.com',
        studentPhone: null,
        studentId: null,
        stageId: null,
        coachId: null,
        sourceData: {},
        globalScore: null,
        confidenceIndex: null,
        domainScores: null,
        status: 'PENDING',
        progress: 0,
        isPublished: false,
        retryCount: 0,
        ragUsed: false,
        ragCollections: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.bilan.create.mockResolvedValue(mockBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans', {
        method: 'POST',
        body: JSON.stringify({
          type: 'ASSESSMENT_QCM',
          subject: 'NSI',
          studentName: 'Marie Curie',
          studentEmail: 'marie@example.com',
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('new-bilan-123');
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/bilans', {
        method: 'POST',
        body: JSON.stringify({ subject: 'MATHS' }), // Missing type, studentName, studentEmail
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Missing required fields');
    });
  });
});
