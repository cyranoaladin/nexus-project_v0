/**
 * F50: Bilan Export API Tests
 * Tests for /api/bilans/[id]/export
 */

import { GET, POST } from '@/app/api/bilans/[id]/export/route';
import { requireAnyRole } from '@/lib/guards';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(() => false),
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilan: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  bilan: {
    findFirst: jest.Mock;
  };
};
const mockRequireAnyRole = requireAnyRole as jest.Mock;

describe('F50: /api/bilans/[id]/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
  });

  const mockBilan = {
    id: 'bilan-123',
    publicShareId: 'share-abc',
    type: 'DIAGNOSTIC_PRE_STAGE',
    subject: 'MATHS',
    studentName: 'Jean Dupont',
    studentEmail: 'jean@example.com',
    studentMarkdown: '# Bilan pour Jean\n\nTu progresses bien!',
    parentsMarkdown: '# Bilan pour les parents\n\nVotre enfant progresse.',
    nexusMarkdown: '# Bilan technique\n\nScore: 75/100',
    globalScore: 75,
    confidenceIndex: 80,
    status: 'COMPLETED',
    isPublished: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  };

  describe('GET /api/bilans/[id]/export', () => {
    it('should export all audiences in markdown format', async () => {
      mockPrisma.bilan.findFirst.mockResolvedValue(mockBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123/export?format=markdown&audience=all');
      const response = await GET(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.bilanId).toBe('bilan-123');
      expect(body.data.content.student).toContain('Jean');
      expect(body.data.content.parents).toContain('parents');
      expect(body.data.content.nexus).toContain('technique');
    });

    it('should export single audience', async () => {
      mockPrisma.bilan.findFirst.mockResolvedValue(mockBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123/export?format=markdown&audience=student');
      const response = await GET(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.content.student).toBeDefined();
      expect(body.data.content.parents).toBeUndefined();
      expect(body.data.content.nexus).toBeUndefined();
    });

    it('should return PDF placeholder for pdf format', async () => {
      mockPrisma.bilan.findFirst.mockResolvedValue(mockBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123/export?format=pdf');
      const response = await GET(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.format).toBe('pdf');
      expect(body.message).toContain('@react-pdf/renderer');
    });

    it('should return 404 for non-existent bilan', async () => {
      mockPrisma.bilan.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/bilans/nonexistent/export');
      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(response.status).toBe(404);
    });

    it('should scope non-staff export to published own bilan', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'eleve-1', role: 'ELEVE', email: 'jean@example.com' } });
      mockPrisma.bilan.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123/export');
      const response = await GET(request, { params: Promise.resolve({ id: 'bilan-123' }) });

      expect(response.status).toBe(404);
      expect(mockPrisma.bilan.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: 'bilan-123',
          isPublished: true,
        }),
      }));
    });
  });

  describe('POST /api/bilans/[id]/export', () => {
    it('should queue export generation for completed bilan', async () => {
      mockPrisma.bilan.findFirst.mockResolvedValue(mockBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123/export', {
        method: 'POST',
        body: JSON.stringify({ format: 'pdf' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('queued');
    });

    it('should reject export for non-completed bilan', async () => {
      const pendingBilan = { ...mockBilan, status: 'PENDING' };
      mockPrisma.bilan.findFirst.mockResolvedValue(pendingBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/bilan-123/export', {
        method: 'POST',
        body: JSON.stringify({ format: 'pdf' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'bilan-123' }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('must be COMPLETED');
    });
  });
});
