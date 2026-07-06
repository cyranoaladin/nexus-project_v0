import { POST } from '@/app/api/assessments/submit/route';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import {
  buildAssessmentAliasEmail,
  createAssessmentPublicToken,
  hashAssessmentLeadEmail,
} from '@/lib/assessments/public-token';
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

function validBody(email: string, overrides: Record<string, unknown> = {}) {
  return {
    subject: 'MATHS',
    grade: 'TERMINALE',
    studentData: {
      email,
      name: 'Élève Nexus',
    },
    answers: {
      'MATH-COMB-01': 'a',
    },
    ...overrides,
  };
}

function request(body: unknown, publicToken: string) {
  return new Request('http://localhost/api/assessments/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-assessment-public-token': publicToken,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assessments/submit lead token binding', () => {
  const originalSecret = process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = 'test-assessment-secret';
    (guardRateLimitAsync as jest.Mock).mockResolvedValue(null);
    (prisma.assessment.create as jest.Mock).mockResolvedValue({
      id: 'assessment-internal-id',
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

  it('accepts a lead-bound token only with the matching pseudonymous assessment email', async () => {
    const leadEmailHash = hashAssessmentLeadEmail('parent@example.test');
    const assessmentEmail = buildAssessmentAliasEmail(leadEmailHash);
    const token = createAssessmentPublicToken({
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      binding: 'lead',
      leadEmailHash,
    });

    const response = await POST(request(validBody(assessmentEmail), token) as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it('rejects replaying a lead-bound token with another email before persistence', async () => {
    const leadEmailHash = hashAssessmentLeadEmail('parent@example.test');
    const token = createAssessmentPublicToken({
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      binding: 'lead',
      leadEmailHash,
    });

    const response = await POST(request(validBody('attacker@example.test'), token) as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });
});
