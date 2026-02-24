/**
 * Assessment Export API — Complete Test Suite
 *
 * Tests: GET /api/assessments/[id]/export
 *
 * Source: app/api/assessments/[id]/export/route.ts
 */

jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
}));

jest.mock('@/lib/pdf/assessment-template', () => ({
  AssessmentPDFDocument: jest.fn(),
}));

jest.mock('@/lib/core/statistics/normalize', () => ({
  getSSNLabel: jest.fn().mockReturnValue('Bon'),
  computePercentile: jest.fn().mockReturnValue(75),
}));

import { GET } from '@/app/api/assessments/[id]/export/route';
import { NextRequest } from 'next/server';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/assessments/${id}/export`, { method: 'GET' });
  return [req, { params: Promise.resolve({ id }) }];
}

describe('GET /api/assessments/[id]/export', () => {
  it('should return 404 when assessment not found', async () => {
    prisma.assessment.findUnique.mockResolvedValue(null);

    const res = await GET(...makeRequest('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('should return 400 when assessment not completed', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1', status: 'PENDING', subject: 'MATHS',
    });

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('not yet completed');
  });

  it('should generate PDF for completed assessment', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      subject: 'MATHS',
      grade: 'Terminale',
      studentName: 'Ahmed Ben Ali',
      studentEmail: 'ahmed@test.com',
      globalScore: 72,
      confidenceIndex: 85,
      scoringResult: { strengths: ['Analyse'], weaknesses: ['Géométrie'], recommendations: ['Pratiquer'] },
      status: 'COMPLETED',
      createdAt: new Date('2026-02-15'),
    });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ ssn: 68.5 }]) // SSN
      .mockResolvedValueOnce([{ domain: 'analysis', score: 80 }]) // domain scores
      .mockResolvedValueOnce([{ skillTag: 'suites', score: 40 }]) // skill scores
      .mockResolvedValueOnce([{ ssn: 50 }, { ssn: 60 }]); // cohort SSNs

    const res = await GET(...makeRequest('a1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('ahmed-ben-ali');
  });

  it('should handle null SSN gracefully', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      subject: 'MATHS',
      grade: 'Terminale',
      studentName: 'Ahmed',
      studentEmail: 'a@t.com',
      globalScore: 50,
      confidenceIndex: 60,
      scoringResult: null,
      status: 'COMPLETED',
      createdAt: new Date(),
    });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ ssn: null }]) // no SSN
      .mockResolvedValueOnce([]) // no domain scores
      .mockResolvedValueOnce([]); // no skill scores

    const res = await GET(...makeRequest('a1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('should return 500 on DB error', async () => {
    prisma.assessment.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await GET(...makeRequest('a1'));
    expect(res.status).toBe(500);
  });
});
