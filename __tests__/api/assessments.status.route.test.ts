/**
 * Assessment Status API — Complete Test Suite
 *
 * Tests: GET /api/assessments/[id]/status
 *
 * Source: app/api/assessments/[id]/status/route.ts
 */

jest.mock('@/app/api/assessments/submit/types', () => ({
  assessmentStatusSchema: {
    parse: jest.fn((v: unknown) => v),
  },
}));

import { GET } from '@/app/api/assessments/[id]/status/route';
import { NextRequest } from 'next/server';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/assessments/${id}/status`, { method: 'GET' });
  return [req, { params: Promise.resolve({ id }) }];
}

describe('GET /api/assessments/[id]/status', () => {
  it('should return 404 when assessment not found', async () => {
    prisma.assessment.findUnique.mockResolvedValue(null);

    const res = await GET(...makeRequest('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('should return PENDING status', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'PENDING',
      progress: 0,
      globalScore: null,
      confidenceIndex: null,
      errorCode: null,
      errorDetails: null,
    });

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('PENDING');
    expect(body.message).toContain('attente');
  });

  it('should return COMPLETED status with result', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'COMPLETED',
      progress: 100,
      globalScore: 72,
      confidenceIndex: 85,
      errorCode: null,
      errorDetails: null,
    });

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('COMPLETED');
    expect(body.result.globalScore).toBe(72);
    expect(body.result.confidenceIndex).toBe(85);
    expect(body.message).toContain('prêt');
  });

  it('should return SCORING status', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'SCORING',
      progress: 50,
      globalScore: null,
      confidenceIndex: null,
      errorCode: null,
      errorDetails: null,
    });

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(body.status).toBe('SCORING');
    expect(body.message).toContain('Calcul');
  });

  it('should return GENERATING status', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'GENERATING',
      progress: 75,
      globalScore: null,
      confidenceIndex: null,
      errorCode: null,
      errorDetails: null,
    });

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(body.status).toBe('GENERATING');
    expect(body.message).toContain('Génération');
  });

  it('should return FAILED status', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'FAILED',
      progress: 0,
      globalScore: null,
      confidenceIndex: null,
      errorCode: 'LLM_TIMEOUT',
      errorDetails: 'Ollama timeout',
    });

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(body.status).toBe('FAILED');
    expect(body.message).toContain('erreur');
  });

  it('should return 500 on DB error', async () => {
    prisma.assessment.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await GET(...makeRequest('a1'));
    expect(res.status).toBe(500);
  });
});
