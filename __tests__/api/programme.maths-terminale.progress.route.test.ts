/**
 * Programme Maths Terminale Progress API — Complete Test Suite (F16/F17 Prisma)
 *
 * Tests: GET & POST /api/programme/maths-terminale/progress
 *
 * Source: app/api/programme/maths-terminale/progress/route.ts
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

import { GET, POST } from '@/app/api/programme/maths-terminale/progress/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;
const mockUpsert = prisma.mathsProgress.upsert as jest.Mock;
const mockFindUnique = prisma.mathsProgress.findUnique as jest.Mock;

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

// ─── GET ─────────────────────────────────────────────────────────────────────

describe('GET /api/programme/maths-terminale/progress', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Authentication');
  });

  it('should return data from Prisma with level TERMINALE', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockFindUnique.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      level: 'TERMINALE',
      completedChapters: ['ch1'],
      totalXp: 200,
      errorTags: { signe: 1 },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.total_xp).toBe(200);
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_level: { userId: 'u1', level: 'TERMINALE' } },
      })
    );
  });

  it('should return null data when no record found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockFindUnique.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe('POST /api/programme/maths-terminale/progress', () => {
  function makeRequest(body: unknown): Request {
    return new Request('http://localhost:3000/api/programme/maths-terminale/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid payload', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const res = await POST(makeRequest({ invalid: true }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid');
  });

  it('should persist to Prisma with level TERMINALE', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockUpsert.mockResolvedValue({ id: 'p1', userId: 'u1', level: 'TERMINALE' });

    const res = await POST(makeRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.persisted).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_level: { userId: 'u1', level: 'TERMINALE' } },
        create: expect.objectContaining({ userId: 'u1', level: 'TERMINALE' }),
        update: expect.any(Object),
      })
    );
  });

  it('should return 500 on Prisma error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockUpsert.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(500);
  });
});
