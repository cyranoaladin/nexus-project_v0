/**
 * Assessment Result API — Complete Test Suite
 *
 * Tests: GET /api/assessments/[id]/result
 *
 * Source: app/api/assessments/[id]/result/route.ts
 */

jest.mock('@/lib/assessments/core/schemas', () => ({
  scoringResultSchema: {},
  analysisJsonSchema: {},
  safeParse: jest.fn((_, v: unknown) => v),
}));

jest.mock('@/lib/core/statistics/normalize', () => ({
  computePercentile: jest.fn().mockReturnValue(75),
}));

jest.mock('@/lib/core/statistics/cohort', () => ({
  computeCohortStats: jest.fn().mockResolvedValue({
    mean: 55.3,
    std: 12.1,
    n: 42,
    isLowSample: false,
  }),
}));

jest.mock('@/lib/core/assessment-status', () => ({
  isCompletedAssessmentStatus: jest.fn(),
  COMPLETED_STATUSES: ['COMPLETED', 'ANALYZED', 'SCORE_ONLY'],
}));

jest.mock('@/lib/assessments/core/config', () => ({
  getCanonicalDomains: jest.fn().mockReturnValue(['analysis', 'algebra', 'geometry']),
}));

import { GET } from '@/app/api/assessments/[id]/result/route';
import { isCompletedAssessmentStatus } from '@/lib/core/assessment-status';
import { NextRequest } from 'next/server';

const mockIsCompleted = isCompletedAssessmentStatus as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/assessments/${id}/result`, { method: 'GET' });
  return [req, { params: Promise.resolve({ id }) }];
}

describe('GET /api/assessments/[id]/result', () => {
  it('should return 404 when assessment not found', async () => {
    prisma.assessment.findUnique.mockResolvedValue(null);

    const res = await GET(...makeRequest('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('should return 400 when assessment not completed', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1', status: 'PENDING', subject: 'MATHS',
    });
    mockIsCompleted.mockReturnValue(false);

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('not yet completed');
  });

  it('should return full result for completed assessment', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      subject: 'MATHS',
      grade: 'Terminale',
      studentName: 'Ahmed',
      studentEmail: 'ahmed@test.com',
      globalScore: 72,
      confidenceIndex: 85,
      scoringResult: { domains: [] },
      analysisJson: { forces: [], faiblesses: [] },
      studentMarkdown: '# Bilan',
      parentsMarkdown: '# Parents',
      status: 'ANALYZED',
      errorCode: null,
      createdAt: new Date('2026-02-15'),
    });
    mockIsCompleted.mockReturnValue(true);
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ ssn: 68.5 }]) // SSN query
      .mockResolvedValueOnce([{ domain: 'analysis', score: 80 }, { domain: 'algebra', score: 60 }]) // domain scores
      .mockResolvedValueOnce([{ skillTag: 'suites', score: 40 }]) // skill scores
      .mockResolvedValueOnce([{ ssn: 50 }, { ssn: 60 }, { ssn: 70 }]); // cohort SSNs

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.globalScore).toBe(72);
    expect(body.ssn).toBe(68.5);
    expect(body.domainScores).toHaveLength(3); // canonical domains
    expect(body.percentile).toBe(75);
    expect(body.cohortMean).toBe(55.3);
    expect(body.generationStatus).toBe('COMPLETE');
  });

  it('should handle LLM failure gracefully', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1',
      subject: 'MATHS',
      grade: 'Terminale',
      studentName: 'Ahmed',
      studentEmail: 'ahmed@test.com',
      globalScore: 72,
      confidenceIndex: 85,
      scoringResult: {},
      analysisJson: {},
      studentMarkdown: null,
      parentsMarkdown: null,
      status: 'SCORE_ONLY',
      errorCode: 'LLM_GENERATION_FAILED',
      createdAt: new Date(),
    });
    mockIsCompleted.mockReturnValue(true);
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ ssn: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await GET(...makeRequest('a1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.generationStatus).toBe('FAILED');
    expect(body.llmUnavailableMessage).toBeTruthy();
  });

  it('should return 500 on DB error', async () => {
    prisma.assessment.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await GET(...makeRequest('a1'));
    expect(res.status).toBe(500);
  });
});
