/**
 * Integration Tests — POST /api/assessments/submit
 *
 * Tests the assessment submission endpoint with mocked Prisma.
 */

import { POST } from '@/app/api/assessments/submit/route';
import { prisma } from '@/lib/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
  }),
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
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.assessment.create as jest.Mock).mockResolvedValue({
      id: 'test-assessment-id',
      subject: 'MATHS',
      grade: 'TERMINALE',
      status: 'SCORING',
      globalScore: 50,
    });
    (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
});
