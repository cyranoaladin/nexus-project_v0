/**
 * F50: Bilan Individual API Tests
 * Tests for GET/PUT/DELETE /api/bilans/[id]
 */

import { GET, PUT, DELETE } from '@/app/api/bilans/[id]/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(() => Promise.resolve({ user: { id: 'admin-1', role: 'ADMIN' } })),
  isErrorResponse: jest.fn(() => false),
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilan: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  bilan: {
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('F50: /api/bilans/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockBilan = {
    id: 'bilan-123',
    type: 'DIAGNOSTIC_PRE_STAGE',
    subject: 'MATHS',
    studentName: 'Jean Dupont',
    studentEmail: 'jean@example.com',
    status: 'COMPLETED',
    globalScore: 75,
    studentMarkdown: '# Bilan élève',
    parentsMarkdown: '# Bilan parents',
    nexusMarkdown: '# Bilan Nexus',
    student: {
      id: 'stu-1',
      grade: 'Terminale',
      school: 'Lycée XYZ',
      user: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' },
    },
    stage: null,
    coach: null,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  };

  describe('GET /api/bilans/[id]', () => {
    it('should return a single bilan', async () => {
      mockPrisma.bilan.findUnique.mockResolvedValue(mockBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('bilan-123');
      expect(body.data.studentName).toBe('Jean Dupont');
    });

    it('should return 404 for non-existent bilan', async () => {
      mockPrisma.bilan.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/bilans/nonexistent');
      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Bilan not found');
    });
  });

  describe('PUT /api/bilans/[id]', () => {
    it('should update bilan status and scores', async () => {
      const updatedBilan = { ...mockBilan, status: 'GENERATING', progress: 50 };
      mockPrisma.bilan.findUnique.mockResolvedValue(mockBilan);
      mockPrisma.bilan.update.mockResolvedValue(updatedBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123', {
        method: 'PUT',
        body: JSON.stringify({ status: 'GENERATING', progress: 50 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('GENERATING');
    });

    it('should update markdown content', async () => {
      const updatedBilan = { ...mockBilan, studentMarkdown: '# Nouveau bilan' };
      mockPrisma.bilan.findUnique.mockResolvedValue(mockBilan);
      mockPrisma.bilan.update.mockResolvedValue(updatedBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123', {
        method: 'PUT',
        body: JSON.stringify({ studentMarkdown: '# Nouveau bilan' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should handle publish with publishedAt', async () => {
      const publishedBilan = { ...mockBilan, isPublished: true, publishedAt: new Date() };
      mockPrisma.bilan.findUnique.mockResolvedValue(mockBilan);
      mockPrisma.bilan.update.mockResolvedValue(publishedBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123', {
        method: 'PUT',
        body: JSON.stringify({ isPublished: true }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'bilan-123' }) });

      expect(response.status).toBe(200);
      expect(mockPrisma.bilan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPublished: true,
            publishedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('DELETE /api/bilans/[id]', () => {
    it('should delete a bilan', async () => {
      mockPrisma.bilan.findUnique.mockResolvedValue(mockBilan);
      mockPrisma.bilan.delete.mockResolvedValue(mockBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Bilan deleted successfully');
    });

    it('should return 404 for non-existent bilan on delete', async () => {
      mockPrisma.bilan.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/bilans/nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Bilan not found');
    });
  });
});
