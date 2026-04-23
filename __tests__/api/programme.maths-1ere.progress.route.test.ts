/**
 * Programme Maths 1ère Progress API — Complete Test Suite (F16/F17 Prisma)
 *
 * Tests: POST /api/programme/maths-1ere/progress
 *
 * Source: app/api/programme/maths-1ere/progress/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    mathsProgress: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { POST, GET } from '@/app/api/programme/maths-1ere/progress/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;
const mockUpsert = prisma.mathsProgress.upsert as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

const validPayload = {
  completed_chapters: ['ch1'],
  mastered_chapters: [],
  total_xp: 100,
  quiz_score: 80,
  combo_count: 3,
  best_combo: 5,
  streak: 2,
  streak_freezes: 0,
  last_activity_date: '2026-02-15',
  daily_challenge: {},
  exercise_results: {},
  hint_usage: {},
  badges: ['first_step'],
  srs_queue: {},
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/programme/maths-1ere/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/programme/maths-1ere/progress', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it('should persist to Prisma with level PREMIERE', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockUpsert.mockResolvedValue({ id: 'progress-1', userId: 'u1', level: 'PREMIERE' });

    const res = await POST(makeRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.persisted).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_level: { userId: 'u1', level: 'PREMIERE' } },
        create: expect.objectContaining({ userId: 'u1', level: 'PREMIERE' }),
        update: expect.any(Object),
      })
    );
  });

  it('should return 400 for invalid payload', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const res = await POST(makeRequest({ invalid: true }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid');
  });

  it('should return 500 on Prisma error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockUpsert.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(500);
  });

  describe('F16/F17 — Prisma source of truth', () => {
    it('POST creates progress with userId + level PREMIERE', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
      mockUpsert.mockResolvedValue({ id: 'p1', userId: 'u1', level: 'PREMIERE' });

      const res = await POST(makeRequest(validPayload));
      expect(res.status).toBe(200);
    });

    it('GET returns progress for PREMIERE level', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
      (prisma.mathsProgress.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        level: 'PREMIERE',
        completedChapters: ['ch1'],
        totalXp: 100,
      });

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.total_xp).toBe(100);
    });
  });

  it('should return 400 for invalid JSON', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const req = new Request('http://localhost:3000/api/programme/maths-1ere/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
