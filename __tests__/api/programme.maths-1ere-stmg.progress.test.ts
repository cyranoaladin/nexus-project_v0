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

import { POST, GET } from '@/app/api/programme/maths-1ere-stmg/progress/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const payload = {
  completed_chapters: ['CH_STMG_MATH_SUITES'],
  mastered_chapters: [],
  total_xp: 50,
  quiz_score: 70,
  combo_count: 2,
  best_combo: 3,
  streak: 1,
  streak_freezes: 0,
  last_activity_date: '2026-04-25',
  daily_challenge: {},
  exercise_results: {},
  hint_usage: {},
  badges: [],
  srs_queue: {},
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/programme/maths-1ere-stmg/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Maths 1ere STMG progress API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists progress with track STMG', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u-stmg' } });
    (prisma.mathsProgress.upsert as jest.Mock).mockResolvedValue({ id: 'p1' });

    const response = await POST(makeRequest(payload));

    expect(response.status).toBe(200);
    expect(prisma.mathsProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_level_track: { userId: 'u-stmg', level: 'PREMIERE', track: 'STMG' } },
      create: expect.objectContaining({ userId: 'u-stmg', level: 'PREMIERE', track: 'STMG' }),
    }));
  });

  it('loads progress with track STMG', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u-stmg' } });
    (prisma.mathsProgress.findUnique as jest.Mock).mockResolvedValue({
      ...payload,
      completedChapters: payload.completed_chapters,
      masteredChapters: payload.mastered_chapters,
      totalXp: 50,
      quizScore: 70,
      comboCount: 2,
      bestCombo: 3,
      streakFreezes: 0,
      lastActivityDate: '2026-04-25',
      dailyChallenge: {},
      exerciseResults: {},
      hintUsage: {},
      srsQueue: {},
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(prisma.mathsProgress.findUnique).toHaveBeenCalledWith({
      where: { userId_level_track: { userId: 'u-stmg', level: 'PREMIERE', track: 'STMG' } },
    });
  });
});
