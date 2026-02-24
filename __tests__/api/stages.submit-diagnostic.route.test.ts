/**
 * Stages Submit Diagnostic API — Complete Test Suite
 *
 * Tests: POST /api/stages/submit-diagnostic
 *
 * Source: app/api/stages/submit-diagnostic/route.ts
 */

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/scoring-engine', () => ({
  computeStageScore: jest.fn().mockReturnValue({
    globalScore: 65,
    confidenceIndex: 80,
    precisionIndex: 75,
    strengths: ['Analyse'],
    weaknesses: ['Géométrie'],
    totalQuestions: 20,
    totalAttempted: 16,
    totalCorrect: 12,
    totalNSP: 4,
    scoredAt: '2026-02-15T10:00:00Z',
  }),
}));

jest.mock('@/lib/data/stage-qcm-structure', () => ({
  ALL_STAGE_QUESTIONS: [
    {
      id: 'q1',
      subject: 'MATHS',
      category: 'Analyse',
      competence: 'Appliquer',
      weight: 1,
      label: 'Question 1',
      options: [
        { id: 'o1', text: 'A', isCorrect: true },
        { id: 'o2', text: 'B', isCorrect: false },
      ],
    },
  ],
}));

jest.mock('@/lib/email', () => ({
  sendStageBilanReady: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/stages/submit-diagnostic/route';
import { NextRequest } from 'next/server';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/stages/submit-diagnostic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/stages/submit-diagnostic', () => {
  const validBody = {
    email: 'student@test.com',
    answers: [{ questionId: 'q1', selectedOptionId: 'o1', isNSP: false }],
  };

  it('should return 400 for invalid email', async () => {
    const res = await POST(makeRequest({ email: 'bad', answers: [{ questionId: 'q1', selectedOptionId: 'o1', isNSP: false }] }));
    expect(res.status).toBe(400);
  });

  it('should return 400 for empty answers', async () => {
    const res = await POST(makeRequest({ email: 'test@test.com', answers: [] }));
    expect(res.status).toBe(400);
  });

  it('should return 404 when no reservation found', async () => {
    prisma.stageReservation.findUnique.mockResolvedValue(null);
    prisma.stageReservation.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('réservation');
  });

  it('should return 409 when already scored', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue({
      id: 'res-1',
      email: 'student@test.com',
      scoringResult: { globalScore: 50 },
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('déjà passé');
  });

  it('should score and persist result', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue({
      id: 'res-1',
      email: 'student@test.com',
      scoringResult: null,
      parentName: 'Karim',
      studentName: 'Ahmed',
      academyId: 'ac-1',
      academyTitle: 'Maths Intensive',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.globalScore).toBe(65);
    expect(body.confidenceIndex).toBe(80);
    expect(body.strengths).toContain('Analyse');
    expect(prisma.stageReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-1' },
      })
    );
  });

  it('should find reservation by reservationId first', async () => {
    prisma.stageReservation.findUnique.mockResolvedValue({
      id: 'res-2',
      email: 'student@test.com',
      scoringResult: null,
      parentName: 'Karim',
      studentName: 'Ahmed',
      academyTitle: 'NSI',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    const res = await POST(makeRequest({ ...validBody, reservationId: 'res-2' }));
    expect(res.status).toBe(200);
    expect(prisma.stageReservation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'res-2' } })
    );
  });

  it('should handle NSP answers', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue({
      id: 'res-1',
      email: 'student@test.com',
      scoringResult: null,
      parentName: 'K',
      studentName: 'A',
      academyTitle: 'T',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    const res = await POST(makeRequest({
      email: 'student@test.com',
      answers: [{ questionId: 'q1', selectedOptionId: null, isNSP: true }],
    }));

    expect(res.status).toBe(200);
  });

  it('should return 500 on DB error', async () => {
    prisma.stageReservation.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
