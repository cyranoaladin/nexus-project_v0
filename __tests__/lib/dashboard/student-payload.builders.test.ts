/**
 * Unit tests for the internal builder helpers in student-payload.ts.
 *
 * Builders (toBilan, toResource, toStageItem, toTrajectoryMilestone,
 * toAutomatismesProgress, computeCredits, buildAlertes) are tested
 * by driving buildStudentDashboardPayload with targeted Prisma mocks
 * and checking the resulting payload fields.
 */

import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { prisma } from '@/lib/prisma';
import { getUserEntitlements } from '@/lib/entitlement/engine';
import { getActiveTrajectory, parseMilestones } from '@/lib/trajectory';
import { getNextStep } from '@/lib/next-step-engine';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    mathsProgress: { findFirst: jest.fn() },
    bilan: { findMany: jest.fn() },
    stageReservation: { findMany: jest.fn() },
    userDocument: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/entitlement/engine', () => ({
  getUserEntitlements: jest.fn(),
}));

jest.mock('@/lib/trajectory', () => ({
  getActiveTrajectory: jest.fn(),
  parseMilestones: jest.fn(),
}));

jest.mock('@/lib/next-step-engine', () => ({
  getNextStep: jest.fn(),
}));

// ─── Minimal student fixture ──────────────────────────────────────────────────

const BASE_STUDENT = {
  id: 'student-1',
  userId: 'user-1',
  grade: 'PREMIERE',
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  specialties: ['MATHEMATIQUES'],
  stmgPathway: null,
  survivalMode: false,
  survivalModeReason: null,
  school: null,
  credits: 0,
  totalSessions: 0,
  user: { email: 'eleve@test.com', firstName: 'Nour', lastName: 'BenAli', mathsProgress: [] },
  sessions: [],
  ariaConversations: [],
  creditTransactions: [],
  badges: [],
  survivalProgress: null,
};

function setupMocks(studentOverride = {}) {
  (prisma.student.findUnique as jest.Mock).mockResolvedValue({ ...BASE_STUDENT, ...studentOverride });
  (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.bilan.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.stageReservation.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.userDocument.findMany as jest.Mock).mockResolvedValue([]);
  (getUserEntitlements as jest.Mock).mockResolvedValue([]);
  (getActiveTrajectory as jest.Mock).mockResolvedValue(null);
  (parseMilestones as jest.Mock).mockReturnValue([]);
  (getNextStep as jest.Mock).mockResolvedValue(null);
}

// ─── toBilan ─────────────────────────────────────────────────────────────────

describe('toBilan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('extracts trustLevel from analysisJson', async () => {
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([{
      id: 'b1', publicShareId: 'p1', type: 'DIAGNOSTIC_PRE_STAGE', subject: 'MATHEMATIQUES',
      status: 'COMPLETED', globalScore: 80, ssn: 12, confidenceIndex: 0.85,
      analysisJson: { trustLevel: 'medium', topPriorities: ['A', 'B'] },
      parentsMarkdown: null, createdAt: new Date('2026-03-15'),
    }]);

    const result = await buildStudentDashboardPayload('user-1');
    const b = result.recentBilans[0];

    expect(b.trustLevel).toBe('medium');
    expect(b.topPriorities).toEqual(['A', 'B']);
    expect(b.hasParentsRender).toBe(false);
  });

  it('returns null trustLevel when analysisJson is null', async () => {
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([{
      id: 'b2', publicShareId: 'p2', type: 'ASSESSMENT_QCM', subject: 'NSI',
      status: 'SCORING', globalScore: null, ssn: null, confidenceIndex: null,
      analysisJson: null, parentsMarkdown: null, createdAt: new Date(),
    }]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.recentBilans[0].trustLevel).toBeNull();
    expect(result.recentBilans[0].topPriorities).toEqual([]);
  });

  it('caps topPriorities at 3 items', async () => {
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([{
      id: 'b3', publicShareId: 'p3', type: 'CONTINUOUS', subject: 'MATHS_STMG',
      status: 'COMPLETED', globalScore: 65, ssn: null, confidenceIndex: null,
      analysisJson: { topPriorities: ['X1', 'X2', 'X3', 'X4', 'X5'] },
      parentsMarkdown: 'parents content', createdAt: new Date(),
    }]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.recentBilans[0].topPriorities).toHaveLength(3);
    expect(result.recentBilans[0].hasParentsRender).toBe(true);
  });

  it('rejects invalid trustLevel values', async () => {
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([{
      id: 'b4', publicShareId: 'p4', type: 'CONTINUOUS', subject: 'MANAGEMENT',
      status: 'COMPLETED', globalScore: 70, ssn: null, confidenceIndex: null,
      analysisJson: { trustLevel: 'excellent' }, // invalid
      parentsMarkdown: null, createdAt: new Date(),
    }]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.recentBilans[0].trustLevel).toBeNull();
  });

  it('builds correct resultUrl from publicShareId', async () => {
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([{
      id: 'b5', publicShareId: 'xyz-share-id', type: 'STAGE_POST', subject: 'DROIT_ECO',
      status: 'COMPLETED', globalScore: 55, ssn: null, confidenceIndex: null,
      analysisJson: null, parentsMarkdown: null, createdAt: new Date(),
    }]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.recentBilans[0].resultUrl).toBe('/bilan-pallier2-maths/resultat/xyz-share-id');
  });
});

// ─── toResource ───────────────────────────────────────────────────────────────

describe('toResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('constructs downloadUrl from document id', async () => {
    (prisma.userDocument.findMany as jest.Mock).mockResolvedValue([{
      id: 'doc-abc', title: 'Cours Maths', originalName: 'cours.pdf',
      mimeType: 'application/pdf', sizeBytes: 51200, createdAt: new Date(),
    }]);

    const result = await buildStudentDashboardPayload('user-1');

    expect(result.resources[0].downloadUrl).toBe('/api/student/documents/doc-abc/download');
    expect(result.resources[0].type).toBe('USER_DOCUMENT');
    expect(result.resources[0].sizeBytes).toBe(51200);
  });
});

// ─── toStageItem ──────────────────────────────────────────────────────────────

describe('toStageItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('maps PAID reservation status to CONFIRMED', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    (prisma.stageReservation.findMany as jest.Mock).mockResolvedValue([{
      id: 'res-1',
      richStatus: 'PAID',
      status: 'CONFIRMED',
      studentId: 'student-1',
      stage: {
        id: 'stage-1', slug: 'stage-maths-avril', title: 'Stage Maths Avril',
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        location: 'Tunis Centre',
      },
    }]);

    const result = await buildStudentDashboardPayload('user-1');

    expect(result.upcomingStages).toHaveLength(1);
    expect(result.upcomingStages[0].reservationStatus).toBe('CONFIRMED');
    expect(result.upcomingStages[0].location).toBe('Tunis Centre');
  });

  it('maps PENDING_BANK_TRANSFER to PENDING', async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    (prisma.stageReservation.findMany as jest.Mock).mockResolvedValue([{
      id: 'res-2', richStatus: 'PENDING_BANK_TRANSFER', status: 'PENDING',
      studentId: 'student-1',
      stage: {
        id: 'stage-2', slug: 'stage-nsi', title: 'Stage NSI',
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        location: null,
      },
    }]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.upcomingStages[0].reservationStatus).toBe('PENDING');
  });

  it('skips reservations with null stage', async () => {
    (prisma.stageReservation.findMany as jest.Mock).mockResolvedValue([
      { id: 'res-3', richStatus: null, status: 'PENDING', studentId: 'student-1', stage: null },
    ]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.upcomingStages).toHaveLength(0);
    expect(result.pastStages).toHaveLength(0);
  });
});

// ─── toTrajectoryMilestone ────────────────────────────────────────────────────

describe('toTrajectoryMilestone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('marks past uncompleted milestone as IN_PROGRESS (overdue)', async () => {
    (getActiveTrajectory as jest.Mock).mockResolvedValue({ id: 'traj-1', milestones: [] });
    (parseMilestones as jest.Mock).mockReturnValue([
      { id: 'm1', title: 'Overdue bilan', targetDate: '2026-01-01', completed: false, completedAt: null },
    ]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.trajectory.milestones[0].status).toBe('IN_PROGRESS');
  });

  it('marks completed milestone as COMPLETED regardless of targetDate', async () => {
    (getActiveTrajectory as jest.Mock).mockResolvedValue({ id: 'traj-1', milestones: [] });
    (parseMilestones as jest.Mock).mockReturnValue([
      { id: 'm2', title: 'Done!', targetDate: '2025-12-01', completed: true, completedAt: '2025-11-30' },
    ]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.trajectory.milestones[0].status).toBe('COMPLETED');
    expect(result.trajectory.milestones[0].completedAt).toBe('2025-11-30');
  });

  it('marks future uncompleted milestone as UPCOMING', async () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    (getActiveTrajectory as jest.Mock).mockResolvedValue({ id: 'traj-1', milestones: [] });
    (parseMilestones as jest.Mock).mockReturnValue([
      { id: 'm3', title: 'Future', targetDate: future, completed: false, completedAt: null },
    ]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.trajectory.milestones[0].status).toBe('UPCOMING');
  });

  it('returns null nextMilestoneAt when all milestones are completed', async () => {
    (getActiveTrajectory as jest.Mock).mockResolvedValue({ id: 'traj-1', milestones: [] });
    (parseMilestones as jest.Mock).mockReturnValue([
      { id: 'm4', title: 'Done', targetDate: '2026-01-01', completed: true, completedAt: '2026-01-01' },
    ]);

    const result = await buildStudentDashboardPayload('user-1');
    expect(result.trajectory.nextMilestoneAt).toBeNull();
  });
});

// ─── toAutomatismesProgress ───────────────────────────────────────────────────

describe('toAutomatismesProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('computes accuracy = 0 when totalAttempted is 0', async () => {
    (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue({
      id: 'mp1', userId: 'user-1', level: 'PREMIERE', track: 'EDS_GENERALE',
      completedChapters: [], masteredChapters: [], totalXp: 0,
      quizScore: 0, bestCombo: 0, streak: 0, lastActivityDate: null,
      exerciseResults: {},
    });

    const result = await buildStudentDashboardPayload('user-1');

    expect(result.automatismes!.totalAttempted).toBe(0);
    expect(result.automatismes!.accuracy).toBe(0);
  });

  it('uses quizScore as fallback when exerciseResults is empty', async () => {
    (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue({
      id: 'mp2', userId: 'user-1', level: 'PREMIERE', track: 'EDS_GENERALE',
      completedChapters: [], masteredChapters: [], totalXp: 50,
      quizScore: 20, bestCombo: 3, streak: 2, lastActivityDate: '2026-04-20',
      exerciseResults: {},
    });

    const result = await buildStudentDashboardPayload('user-1');

    expect(result.automatismes!.totalAttempted).toBe(20);
    expect(result.automatismes!.lastAttemptAt).toBe('2026-04-20');
  });
});

// ─── computeCredits ───────────────────────────────────────────────────────────

describe('computeCredits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns balance=0 when no transactions', async () => {
    setupMocks({ creditTransactions: [] });

    const result = await buildStudentDashboardPayload('user-1');

    expect(result.credits.balance).toBe(0);
    expect(result.credits.nonExpiredCount).toBe(0);
    expect(result.credits.nextExpiryAt).toBeNull();
  });

  it('picks the earliest expiry date as nextExpiryAt', async () => {
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const later = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setupMocks({
      creditTransactions: [
        { amount: 1, expiresAt: later },
        { amount: 1, expiresAt: soon },
      ],
    });

    const result = await buildStudentDashboardPayload('user-1');

    expect(result.credits.nextExpiryAt).toBe(soon.toISOString());
    expect(result.credits.balance).toBe(2);
  });
});

// ─── buildAlertes ─────────────────────────────────────────────────────────────

describe('buildAlertes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits critical alert when no credits', async () => {
    setupMocks({ creditTransactions: [] });

    const result = await buildStudentDashboardPayload('user-1');

    const criticalAlert = result.cockpit.alertes.find((a) => a.severity === 'critical');
    expect(criticalAlert).toBeDefined();
    expect(criticalAlert!.id).toBe('no-credits');
  });

  it('emits warning when only 1 credit remains', async () => {
    setupMocks({ creditTransactions: [{ amount: 1, expiresAt: null }] });

    const result = await buildStudentDashboardPayload('user-1');

    const warningAlert = result.cockpit.alertes.find((a) => a.id === 'low-credits');
    expect(warningAlert).toBeDefined();
    expect(warningAlert!.severity).toBe('warning');
  });

  it('emits no-session warning when student has no upcoming session', async () => {
    setupMocks({ creditTransactions: [{ amount: 3, expiresAt: null }] });

    const result = await buildStudentDashboardPayload('user-1');

    const sessionAlert = result.cockpit.alertes.find((a) => a.id === 'no-session');
    expect(sessionAlert).toBeDefined();
  });

  it('caps alertes at 3 items', async () => {
    setupMocks({ creditTransactions: [] }); // triggers no-credits + no-session

    const result = await buildStudentDashboardPayload('user-1');

    expect(result.cockpit.alertes.length).toBeLessThanOrEqual(3);
  });
});

// ─── nextSession ordering ─────────────────────────────────────────────────────

describe('nextSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the soonest upcoming session, not the farthest', async () => {
    const now = Date.now();
    const soon  = new Date(now + 1  * 24 * 60 * 60 * 1000); // J+1
    const mid   = new Date(now + 7  * 24 * 60 * 60 * 1000); // J+7
    const far   = new Date(now + 30 * 24 * 60 * 60 * 1000); // J+30

    const makeSession = (id: string, scheduledAt: Date) => ({
      id,
      title: `Session ${id}`,
      subject: 'MATHEMATIQUES',
      status: 'SCHEDULED',
      scheduledAt,
      duration: 60,
      coach: null,
    });

    // Prisma orderBy: { scheduledAt: 'desc' } → far first, soon last
    setupMocks({
      creditTransactions: [{ amount: 5, expiresAt: null }],
      sessions: [makeSession('far', far), makeSession('mid', mid), makeSession('soon', soon)],
    });

    const result = await buildStudentDashboardPayload('user-1');

    expect(result.nextSession).not.toBeNull();
    expect(result.nextSession!.id).toBe('soon');
    expect(result.nextSession!.scheduledAt).toBe(soon.toISOString());
  });
});
