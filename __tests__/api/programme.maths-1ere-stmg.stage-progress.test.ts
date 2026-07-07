jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    mathsProgress: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/programme/maths-1ere-stmg/stage-progress/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const existingProgrammeProgress = {
  id: 'progress-1',
  userId: 'u-stmg',
  completedChapters: ['CH_STMG_STATS'],
  masteredChapters: ['CH_STMG_AUTOMATISMES'],
  totalXp: 340,
  quizScore: 82,
  comboCount: 4,
  bestCombo: 8,
  streak: 3,
  streakFreezes: 1,
  lastActivityDate: '2026-05-30',
  dailyChallenge: { id: 'daily-1' },
  exerciseResults: { stats: [1, 0, 1] },
  hintUsage: { stats: 2 },
  badges: ['regularite'],
  srsQueue: { retry: ['sta-q1'] },
  diagnosticResults: { programme: { score: 72 } },
  timePerChapter: { stats: 120 },
  formulaireViewed: true,
  grandOralSeen: 1,
  labArchimedeOpened: false,
  eulerMaxSteps: 2,
  newtonBestIterations: null,
  printedFiche: true,
};

const stageState = {
  diagnosticAnswers: { qcm: { 'diag-q1': 1 }, exercises: {} },
  profile: {
    diagnosticDate: '2026-05-30T10:00:00.000Z',
    domainScores: [],
    priorities: ['derivation'],
  },
  validatedNotions: {
    fonctions: [],
    derivation: ['Tangente'],
    suites: [],
    statistiques: [],
    probabilites: [],
    'algorithmique-tableur': [],
  },
  automatismHistory: [],
  settings: { countdownEnabled: true, gamificationEnabled: false },
  updatedAt: '2026-05-30T12:00:00.000Z',
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/programme/maths-1ere-stmg/stage-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Maths 1ere STMG stage progress API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
  });

  it('returns only the stage sub-state from programme diagnostic_results', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u-stmg', role: 'ELEVE' } });
    (prisma.mathsProgress.findUnique as jest.Mock).mockResolvedValue({
      ...existingProgrammeProgress,
      diagnosticResults: { programme: { score: 72 }, stage_eam_stmg: stageState },
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, data: stageState });
  });

  it('updates only diagnostic_results.stage_eam_stmg and preserves programme fields', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u-stmg', role: 'ELEVE' } });
    (prisma.mathsProgress.findUnique as jest.Mock).mockResolvedValue(existingProgrammeProgress);
    (prisma.mathsProgress.update as jest.Mock).mockResolvedValue({
      ...existingProgrammeProgress,
      diagnosticResults: {
        programme: { score: 72 },
        stage_eam_stmg: stageState,
      },
    });

    const response = await POST(makeRequest(stageState));

    expect(response.status).toBe(200);
    expect(prisma.mathsProgress.update).toHaveBeenCalledWith({
      where: { userId_level_track: { userId: 'u-stmg', level: 'PREMIERE', track: 'STMG' } },
      data: {
        diagnosticResults: {
          programme: { score: 72 },
          stage_eam_stmg: stageState,
        },
      },
    });
    expect(prisma.mathsProgress.create).not.toHaveBeenCalled();
  });

  it('creates a programme row with defaults only when no programme progress exists', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u-stmg', role: 'ELEVE' } });
    (prisma.mathsProgress.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.mathsProgress.create as jest.Mock).mockResolvedValue({ id: 'new-progress' });

    const response = await POST(makeRequest(stageState));

    expect(response.status).toBe(200);
    expect(prisma.mathsProgress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u-stmg',
        level: 'PREMIERE',
        track: 'STMG',
        completedChapters: [],
        totalXp: 0,
        badges: [],
        srsQueue: {},
        diagnosticResults: { stage_eam_stmg: stageState },
      }),
    });
  });
});
