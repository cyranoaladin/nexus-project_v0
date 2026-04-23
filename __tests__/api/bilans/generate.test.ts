/**
 * F50: Bilan Generation API Tests
 * Tests for /api/bilans/generate
 */

import { GET, POST } from '@/app/api/bilans/generate/route';
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
    },
  },
}));

// Mock the generator
jest.mock('@/lib/bilan/generator', () => ({
  BilanGenerator: {
    generateAndSave: jest.fn().mockResolvedValue({ success: true, result: { studentMarkdown: 'Test' } }),
  },
}));

import { prisma } from '@/lib/prisma';
import { BilanGenerator } from '@/lib/bilan/generator';

const mockPrisma = prisma as unknown as {
  bilan: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

const mockGenerator = BilanGenerator as unknown as {
  generateAndSave: jest.Mock;
};

describe('F50: /api/bilans/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockBilan = {
    id: 'bilan-123',
    type: 'DIAGNOSTIC_PRE_STAGE',
    subject: 'MATHS',
    studentName: 'Jean Dupont',
    studentEmail: 'jean@example.com',
    studentPhone: null,
    sourceData: { competencies: { algebra: 'strong' } },
    globalScore: 75,
    confidenceIndex: 80,
    ssn: null,
    uai: null,
    domainScores: [{ domain: 'algebra', score: 85 }],
    status: 'PENDING',
    progress: 0,
    sourceVersion: 'v1.0',
  };

  describe('POST /api/bilans/generate', () => {
    it('should start generation for pending bilan', async () => {
      mockPrisma.bilan.findUnique.mockResolvedValue(mockBilan);
      mockPrisma.bilan.update.mockResolvedValue({ ...mockBilan, status: 'GENERATING', progress: 25 });

      const request = new NextRequest('http://localhost:3000/api/bilans/generate', {
        method: 'POST',
        body: JSON.stringify({ bilanId: 'bilan-123', enableRAG: true }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('GENERATING');
      expect(body.data.progress).toBe(25);
      expect(mockPrisma.bilan.update).toHaveBeenCalledWith({
        where: { id: 'bilan-123' },
        data: { status: 'GENERATING', progress: 25 },
      });
    });

    it('should return 400 for missing bilanId', async () => {
      const request = new NextRequest('http://localhost:3000/api/bilans/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('bilanId');
    });

    it('should return 404 for non-existent bilan', async () => {
      mockPrisma.bilan.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/bilans/generate', {
        method: 'POST',
        body: JSON.stringify({ bilanId: 'nonexistent' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
    });

    it('should return 409 if already generating', async () => {
      const generatingBilan = { ...mockBilan, status: 'GENERATING' };
      mockPrisma.bilan.findUnique.mockResolvedValue(generatingBilan);

      const request = new NextRequest('http://localhost:3000/api/bilans/generate', {
        method: 'POST',
        body: JSON.stringify({ bilanId: 'bilan-123' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toContain('already being generated');
    });

    it('should support force regeneration for completed bilan', async () => {
      const completedBilan = { ...mockBilan, status: 'COMPLETED' };
      mockPrisma.bilan.findUnique.mockResolvedValue(completedBilan);
      mockPrisma.bilan.update.mockResolvedValue({ ...completedBilan, status: 'GENERATING' });

      const request = new NextRequest('http://localhost:3000/api/bilans/generate', {
        method: 'POST',
        body: JSON.stringify({ bilanId: 'bilan-123', force: true }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/bilans/generate', () => {
    it('should return generation status', async () => {
      mockPrisma.bilan.findUnique.mockResolvedValue({
        ...mockBilan,
        status: 'COMPLETED',
        progress: 100,
        studentMarkdown: '# Bilan',
        parentsMarkdown: '# Bilan parents',
        nexusMarkdown: '# Bilan nexus',
        errorCode: null,
        errorDetails: null,
        engineVersion: 'ollama-qwen2.5:32b',
        ragUsed: true,
      });

      const request = new NextRequest('http://localhost:3000/api/bilans/generate?bilanId=bilan-123');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('COMPLETED');
      expect(body.data.hasStudentMarkdown).toBe(true);
      expect(body.data.hasParentsMarkdown).toBe(true);
      expect(body.data.hasNexusMarkdown).toBe(true);
    });

    it('should return 400 for missing bilanId', async () => {
      const request = new NextRequest('http://localhost:3000/api/bilans/generate');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });
});
