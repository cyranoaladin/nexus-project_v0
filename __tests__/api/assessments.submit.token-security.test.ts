import { POST } from '@/app/api/assessments/submit/route';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { createAssessmentPublicToken } from '@/lib/assessments/public-token';
import { Subject } from '@/lib/assessments/core/types';

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
  }),
}));

jest.mock('@/lib/assessments/questions', () => ({
  QuestionBank: {
    loadByVersion: jest.fn().mockResolvedValue({
      questions: [
        {
          id: 'MATH-COMB-01',
          subject: 'MATHS',
          category: 'Combinatoire',
          weight: 1,
          competencies: ['Restituer'],
          options: [{ id: 'a', isCorrect: true }],
        },
      ],
      resolvedVersion: 'maths_terminale_spe_v1',
    }),
  },
}));

jest.mock('@/lib/assessments/scoring', () => ({
  ScoringFactory: {
    create: jest.fn().mockReturnValue({
      compute: jest.fn().mockReturnValue({
        globalScore: 100,
        confidenceIndex: 80,
        precisionIndex: 75,
        metrics: { categoryScores: { combinatoire: 100 }, competencyScores: {} },
        strengths: ['Combinatoire'],
        weaknesses: [],
        recommendations: [],
      }),
    }),
  },
}));

jest.mock('@/lib/assessments/generators', () => ({
  BilanGenerator: {
    generate: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/core/ssn/computeSSN', () => ({
  computeAndPersistSSN: jest.fn().mockResolvedValue(undefined),
}));

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    subject: 'MATHS',
    grade: 'TERMINALE',
    studentData: {
      email: 'student@example.test',
      name: 'Student Test',
    },
    answers: {
      'MATH-COMB-01': 'a',
    },
    ...overrides,
  };
}

function token(input: { subject?: Subject; grade?: 'PREMIERE' | 'TERMINALE'; ttlSeconds?: number; now?: number } = {}) {
  return createAssessmentPublicToken(
    {
      subject: input.subject ?? Subject.MATHS,
      grade: input.grade ?? 'TERMINALE',
      source: 'bilan-gratuit',
    },
    {
      ttlSeconds: input.ttlSeconds,
      now: input.now,
    },
  );
}

function request(body: unknown, publicToken?: string) {
  return new Request('http://localhost/api/assessments/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(publicToken ? { 'x-assessment-public-token': publicToken } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assessments/submit token security', () => {
  const originalSecret = process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = 'test-assessment-secret';
    (guardRateLimitAsync as jest.Mock).mockResolvedValue(null);
    (prisma.assessment.create as jest.Mock).mockResolvedValue({
      id: 'assessment-internal-id',
      publicShareId: 'assessment-public-share',
      subject: 'MATHS',
      grade: 'TERMINALE',
      status: 'SCORING',
      globalScore: 100,
    });
    (prisma.domainScore.createMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;
    } else {
      process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = originalSecret;
    }
  });

  it('accepts a valid scoped token', async () => {
    const response = await POST(request(validBody(), token()) as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.redirectUrl).toContain('assessment-internal-id');
    expect(JSON.stringify(body)).not.toContain('token');
  });

  it('rejects missing tokens before persistence', async () => {
    const response = await POST(request(validBody()) as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });

  it('rejects expired, malformed, and bad-signature tokens', async () => {
    const expired = token({ now: 1_000, ttlSeconds: 1 });

    const expiredResponse = await POST(request(validBody(), expired) as any);
    expect(expiredResponse.status).toBe(401);

    const malformedResponse = await POST(request(validBody(), 'not-a-token') as any);
    expect(malformedResponse.status).toBe(401);

    const valid = token();
    const badSignatureResponse = await POST(request(validBody(), `${valid.slice(0, -2)}xx`) as any);
    expect(badSignatureResponse.status).toBe(401);

    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });

  it('rejects scope mismatches before persistence', async () => {
    const response = await POST(request(validBody(), token({ subject: Subject.NSI })) as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });

  it('rejects subject and grade mismatches before persistence', async () => {
    const subjectMismatch = await POST(
      request(validBody({ subject: 'NSI' }), token({ subject: Subject.MATHS })) as any,
    );
    expect(subjectMismatch.status).toBe(403);

    const gradeMismatch = await POST(
      request(validBody({ grade: 'PREMIERE' }), token({ grade: 'TERMINALE' })) as any,
    );
    expect(gradeMismatch.status).toBe(403);

    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });

  it('keeps payload validation strict before token validation', async () => {
    const response = await POST(
      request(
        {
          ...validBody(),
          rawPayload: true,
        },
        token(),
      ) as any,
    );

    expect(response.status).toBe(400);
    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });
});
