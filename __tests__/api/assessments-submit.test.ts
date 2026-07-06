/**
 * Integration Tests — POST /api/assessments/submit
 *
 * Tests the assessment submission endpoint with mocked Prisma.
 */

import { POST } from '@/app/api/assessments/submit/route';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { QuestionBank } from '@/lib/assessments/questions';
import { createAssessmentPublicToken } from '@/lib/assessments/public-token';
import { Subject } from '@/lib/assessments/core/types';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
  }),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimit: jest.fn().mockReturnValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

// Mock QuestionBank
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
          questionText: 'Test Q1',
          options: [
            { id: 'a', text: '10', isCorrect: true },
            { id: 'b', text: '20', isCorrect: false },
          ],
        },
        {
          id: 'MATH-COMB-02',
          subject: 'MATHS',
          category: 'Combinatoire',
          weight: 1,
          competencies: ['Appliquer'],
          questionText: 'Test Q2',
          options: [
            { id: 'a', text: '70', isCorrect: true },
            { id: 'b', text: '35', isCorrect: false },
          ],
        },
      ],
      resolvedVersion: 'maths_terminale_spe_v1',
    }),
  },
}));

// Mock ScoringFactory
jest.mock('@/lib/assessments/scoring', () => ({
  ScoringFactory: {
    create: jest.fn().mockReturnValue({
      compute: jest.fn().mockReturnValue({
        globalScore: 50,
        confidenceIndex: 80,
        precisionIndex: 70,
        metrics: {
          categoryScores: { combinatoire: 50 },
          competencyScores: {},
        },
        strengths: ['Combinatoire'],
        weaknesses: [],
        recommendations: ['Continuer'],
      }),
    }),
  },
}));

// Mock BilanGenerator
jest.mock('@/lib/assessments/generators', () => ({
  BilanGenerator: {
    generate: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock SSN computation
jest.mock('@/lib/core/ssn/computeSSN', () => ({
  computeAndPersistSSN: jest.fn().mockResolvedValue(undefined),
}));

// Mock raw-sql-monitor
jest.mock('@/lib/core/raw-sql-monitor', () => ({
  incrementRawSqlFailure: jest.fn().mockReturnValue(1),
}));

describe('POST /api/assessments/submit', () => {
  const originalSecret = process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;

  function assessmentToken() {
    return createAssessmentPublicToken({
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'test',
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = 'test-assessment-secret';
    (prisma.assessment.create as jest.Mock).mockResolvedValue({
      id: 'test-assessment-id',
      subject: 'MATHS',
      grade: 'TERMINALE',
      status: 'SCORING',
      globalScore: 50,
    });
    (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;
    } else {
      process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = originalSecret;
    }
  });

  it('returns 429 when public submission rate limit is exceeded', async () => {
    (guardRateLimitAsync as jest.Mock).mockResolvedValueOnce(
      Response.json({ error: 'RATE_LIMIT' }, { status: 429 })
    );

    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentData: { email: 'test@example.com', name: 'Test Student' },
        answers: { 'MATH-COMB-01': 'a' },
      }),
    });

    const response = await POST(request as any);

    expect(response.status).toBe(429);
    expect(prisma.assessment.create).not.toHaveBeenCalled();
  });

  it('returns 201 with valid payload', async () => {
    const body = {
      subject: 'MATHS',
      grade: 'TERMINALE',
      studentData: {
        email: 'test@example.com',
        name: 'Test Student',
      },
      answers: {
        'MATH-COMB-01': 'a',
        'MATH-COMB-02': 'b',
      },
    };

    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.assessmentId).toBe('test-assessment-id');
    expect(data.redirectUrl).toContain('test-assessment-id');
  });

  it('returns 400 with missing required fields', async () => {
    const body = {
      subject: 'MATHS',
      // missing grade, studentData, answers
    };

    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 with invalid email', async () => {
    const body = {
      subject: 'MATHS',
      grade: 'TERMINALE',
      studentData: {
        email: 'not-an-email',
        name: 'Test',
      },
      answers: { 'Q1': 'a' },
    };

    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it('returns 400 with invalid subject', async () => {
    const body = {
      subject: 'INVALID_SUBJECT',
      grade: 'TERMINALE',
      studentData: {
        email: 'test@example.com',
        name: 'Test',
      },
      answers: { 'Q1': 'a' },
    };

    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it('persists assessment via prisma.assessment.create', async () => {
    const body = {
      subject: 'MATHS',
      grade: 'TERMINALE',
      studentData: {
        email: 'test@example.com',
        name: 'Test Student',
      },
      answers: {
        'MATH-COMB-01': 'a',
      },
    };

    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify(body),
    });

    await POST(request as any);

    expect(prisma.assessment.create).toHaveBeenCalledTimes(1);
    const createCall = (prisma.assessment.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.subject).toBe('MATHS');
    expect(createCall.data.grade).toBe('TERMINALE');
    expect(createCall.data.studentEmail).toBe('test@example.com');
    expect(createCall.data.globalScore).toBe(50);
  });

  it('rejects a client-supplied studentId on public submissions', async () => {
    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify({
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentData: {
          email: 'test@example.com',
          name: 'Test Student',
        },
        studentId: 'student-owned-by-someone-else',
        answers: {
          'MATH-COMB-01': 'a',
        },
      }),
    });

    const response = await POST(request as any);

    expect(response.status).toBe(400);
    expect(prisma.assessment.create).not.toHaveBeenCalled();
    expect(QuestionBank.loadByVersion).not.toHaveBeenCalled();
  });

  it('rejects unexpected nested studentData fields before persistence', async () => {
    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify({
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentData: {
          email: 'test@example.com',
          name: 'Test Student',
          rawPayload: true,
        },
        answers: {
          'MATH-COMB-01': 'a',
        },
      }),
    });

    const response = await POST(request as any);

    expect(response.status).toBe(400);
    expect(prisma.assessment.create).not.toHaveBeenCalled();
    expect(QuestionBank.loadByVersion).not.toHaveBeenCalled();
  });

  it('rejects malformed assessmentVersion before loading questions', async () => {
    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify({
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentData: {
          email: 'test@example.com',
          name: 'Test Student',
        },
        assessmentVersion: '../secret',
        answers: {
          'MATH-COMB-01': 'a',
        },
      }),
    });

    const response = await POST(request as any);

    expect(response.status).toBe(400);
    expect(QuestionBank.loadByVersion).not.toHaveBeenCalled();
  });

  it('does not expose internal exception messages in 500 responses', async () => {
    (prisma.assessment.create as jest.Mock).mockRejectedValueOnce(
      new Error('postgres://secret-db-internal')
    );

    const request = new Request('http://localhost/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-assessment-public-token': assessmentToken(),
      },
      body: JSON.stringify({
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentData: {
          email: 'test@example.com',
          name: 'Test Student',
        },
        answers: {
          'MATH-COMB-01': 'a',
        },
      }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('postgres://secret-db-internal');
    expect(body.message).toBeUndefined();
  });
});
