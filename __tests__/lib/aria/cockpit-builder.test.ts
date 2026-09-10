/**
 * `buildAriaCockpit` — couvre les branches réelles non exercées par le test
 * de route (états dégradés/manquants du payload dashboard et du profil).
 */

import { buildAriaCockpit } from '@/lib/aria/cockpit/builder';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { getAriaCockpitProfile } from '@/lib/aria/cockpit/profile-service';

jest.mock('@/lib/dashboard/student-payload', () => ({
  buildStudentDashboardPayload: jest.fn(),
}));
jest.mock('@/lib/aria/cockpit/profile-service', () => ({ getAriaCockpitProfile: jest.fn() }));

const EMPTY_HUB = {
  byCategory: {
    INTERACTIVE_PROGRAM: [], OFFICIAL_PROGRAM: [], OFFICIAL_AUTOMATISMES: [],
    OFFICIAL_SUJET: [], COACH_RESOURCE: [], USER_DOCUMENT: [], RAG_REFERENCE: [],
    INVOICE: [], RECEIPT: [], STAGE_BILAN: [],
  },
  totalCount: 0,
  recentlyAddedCount: 0,
};

function dashboardPayload(overrides: Record<string, unknown> = {}) {
  return {
    student: {
      id: 'student-1',
      firstName: 'Inès',
      lastName: 'Ben Salah',
      email: 'ines@example.test',
      grade: 'TERMINALE',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      specialties: ['MATHEMATIQUES', 'NSI'],
      stmgPathway: null,
      survivalMode: false,
      survivalModeReason: null,
      school: 'Lycée Test',
    },
    cockpit: {
      seanceDuJour: null as Record<string, unknown> | null,
      feuilleDeRoute: [
        { id: 'fdr-1', type: 'CHAPTER', title: 'Revoir les limites', estimatedMinutes: 30, priority: 1, href: '/x', done: false },
        { id: 'fdr-2', type: 'QCM', title: 'QCM dérivation', estimatedMinutes: 15, priority: 2, href: '/y', done: true },
      ],
      alertes: [],
    },
    trackContent: { specialties: [], stmgModules: [] },
    sessionsCount: 3,
    nextSession: {
      id: 'session-9',
      title: 'Séance Maths',
      subject: 'MATHEMATIQUES',
      scheduledAt: '2026-09-02T14:00:00.000Z',
      duration: 60,
      coach: { firstName: 'Alaeddine', lastName: 'B.', pseudonym: 'Helios' },
    },
    recentSessions: [],
    lastBilan: null,
    recentBilans: [
      {
        id: 'bilan-1', publicShareId: 'share-1', type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHEMATIQUES', subjectLabel: 'Mathématiques', status: 'COMPLETED',
        globalScore: 62, ssn: null, confidenceIndex: null, trustLevel: 'high',
        topPriorities: [], hasParentsRender: false, createdAt: new Date().toISOString(),
        resultUrl: '/r/share-1',
      },
    ],
    upcomingStages: [],
    pastStages: [],
    resources: [],
    hub: EMPTY_HUB,
    ariaStats: { messagesToday: 4, totalConversations: 7, canUseAriaMaths: true, canUseAriaNsi: false },
    badges: [],
    trajectory: {
      id: 'traj-1', title: 'Objectif mention bien', progress: 40, daysRemaining: 120,
      milestones: [
        { id: 'm1', title: 'Diagnostic initial', description: null, targetDate: '2026-09-15', status: 'COMPLETED', category: 'BILAN', completed: true, completedAt: '2026-09-10' },
        { id: 'm2', title: 'Bac blanc n°1', description: null, targetDate: '2026-12-01', status: 'UPCOMING', category: 'BAC', completed: false, completedAt: null },
      ],
      nextMilestoneAt: '2026-12-01',
    },
    automatismes: null,
    survivalProgress: null,
    credits: { balance: 5, nonExpiredCount: 5, nextExpiryAt: null },
    ...overrides,
  };
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    targetSession: null,
    pinnedCourseKeys: ['maths-terminale-eds'],
    weeklyGoalMinutes: 180,
    learningGoals: ['PREPARER_BAC'],
    preferences: {},
    curriculumVersion: 'v1',
    onboardingCompletedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function mockPayload(overrides: Record<string, unknown> = {}) {
  (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(dashboardPayload(overrides));
}
function mockProfile(overrides: Record<string, unknown> = {}) {
  (getAriaCockpitProfile as jest.Mock).mockResolvedValue(profile(overrides));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPayload();
  mockProfile();
});

describe('buildAriaCockpit — entitlements (line 56)', () => {
  it('includes aria_nsi when the dashboard grants NSI chat access', async () => {
    mockPayload({ ariaStats: { messagesToday: 0, totalConversations: 0, canUseAriaMaths: false, canUseAriaNsi: true } });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.curriculum.courses.some((v) => v.course.key === 'nsi-terminale-eds' && v.access.commerciallyEntitled)).toBe(true);
  });
});

describe('buildAriaCockpit — setup state (line 67)', () => {
  it('reports ACADEMIC_PROFILE_INCOMPLETE when the academic map is missing required fields', async () => {
    mockPayload({ student: { ...dashboardPayload().student, gradeLevel: null, academicTrack: null } });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.setup.state).toBe('ACADEMIC_PROFILE_INCOMPLETE');
    expect(cockpit.setup.academicProfileIncomplete).toBe(true);
  });
});

describe('buildAriaCockpit — today (lines 119, 124)', () => {
  it('treats a missing estimatedMinutes as zero when summing planned time', async () => {
    mockPayload({
      cockpit: {
        seanceDuJour: null,
        feuilleDeRoute: [
          { id: 'fdr-1', type: 'CHAPTER', title: 'Sans durée', estimatedMinutes: undefined, priority: 1, href: '/x', done: false },
        ],
        alertes: [],
      },
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.today.plannedMinutes).toBe(0);
  });

  it('reports no planned minutes (null) once every item is done', async () => {
    mockPayload({
      cockpit: {
        seanceDuJour: null,
        feuilleDeRoute: [
          { id: 'fdr-1', type: 'CHAPTER', title: 'Fait', estimatedMinutes: 30, priority: 1, href: '/x', done: true },
        ],
        alertes: [],
      },
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.today.plannedMinutes).toBeNull();
  });
});

describe('buildAriaCockpit — trajectory (lines 131, 133, 134, 140, 141)', () => {
  it('returns null when there is no trajectory at all', async () => {
    mockPayload({ trajectory: null });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.trajectory).toBeNull();
  });

  it('returns null for a trajectory missing an id', async () => {
    mockPayload({ trajectory: { id: '', title: 'x', progress: 0, daysRemaining: null, milestones: [], nextMilestoneAt: null } });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.trajectory).toBeNull();
  });

  it('returns null for a trajectory missing a title', async () => {
    mockPayload({ trajectory: { id: 't1', title: '', progress: 0, daysRemaining: null, milestones: [], nextMilestoneAt: null } });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.trajectory).toBeNull();
  });

  it('defaults milestones to an empty list, reports no next milestone, and no finite days-remaining', async () => {
    mockPayload({
      trajectory: {
        id: 't1', title: 'Sans jalons', progress: 10, daysRemaining: Number.NaN,
        milestones: undefined, nextMilestoneAt: null,
      },
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.trajectory).not.toBeNull();
    expect(cockpit.trajectory!.milestoneCount).toBe(0);
    expect(cockpit.trajectory!.nextMilestone).toBeNull();
    expect(cockpit.trajectory!.daysRemaining).toBeNull();
  });

  it('reports a null target date for a next milestone that has none', async () => {
    mockPayload({
      trajectory: {
        id: 't1', title: 'Sans date', progress: 20, daysRemaining: 30,
        milestones: [
          { id: 'm1', title: 'À venir', description: null, targetDate: null, status: 'UPCOMING', category: 'BAC', completed: false, completedAt: null },
        ],
        nextMilestoneAt: null,
      },
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.trajectory!.nextMilestone).toEqual({ title: 'À venir', targetDate: null });
  });

  it('reports no next milestone once every milestone is completed', async () => {
    mockPayload({
      trajectory: {
        id: 't1', title: 'Tout fait', progress: 100, daysRemaining: 0,
        milestones: [
          { id: 'm1', title: 'Fait', description: null, targetDate: null, status: 'COMPLETED', category: 'BILAN', completed: true, completedAt: '2026-09-10' },
        ],
        nextMilestoneAt: null,
      },
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.trajectory!.nextMilestone).toBeNull();
  });
});

describe('buildAriaCockpit — assessments (lines 166, 167, 168)', () => {
  it('projects a bilan with no subject and no createdAt, classified A_FAIRE', async () => {
    mockPayload({
      recentBilans: [
        {
          id: 'b1', publicShareId: 's1', type: 'DIAGNOSTIC_PRE_STAGE', subject: undefined,
          subjectLabel: 'Sans matière', status: 'PENDING', globalScore: null, ssn: null,
          confidenceIndex: null, trustLevel: 'low', topPriorities: [], hasParentsRender: false,
          createdAt: undefined, resultUrl: '/r/s1',
        },
      ],
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.assessments[0]!.subject).toBeNull();
    expect(cockpit.assessments[0]!.date).toBeNull();
    expect(cockpit.assessments[0]!.state).toBe('A_FAIRE');
  });

  it('classifies an old completed bilan as TERMINE, not RECENT', async () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    mockPayload({
      recentBilans: [
        {
          id: 'b2', publicShareId: 's2', type: 'DIAGNOSTIC_PRE_STAGE', subject: 'MATHEMATIQUES',
          subjectLabel: 'Mathématiques', status: 'COMPLETED', globalScore: 70, ssn: null,
          confidenceIndex: null, trustLevel: 'high', topPriorities: [], hasParentsRender: false,
          createdAt: old, resultUrl: '/r/s2',
        },
      ],
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.assessments[0]!.state).toBe('TERMINE');
  });

  it('defaults recentBilans to an empty list when the dashboard omits it', async () => {
    const payload = dashboardPayload();
    delete (payload as { recentBilans?: unknown }).recentBilans;
    (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(payload);
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.assessments).toEqual([]);
  });
});

describe('buildAriaCockpit — next session (lines 177, 183, 185) and student fields (236-239)', () => {
  it('returns null when there is no next session', async () => {
    mockPayload({ nextSession: null });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.nextSession).toBeNull();
  });

  it('reports no subject and no coach when the next session has neither', async () => {
    mockPayload({
      nextSession: {
        id: 's1', title: 'Séance libre', subject: undefined, scheduledAt: '2026-09-02T14:00:00.000Z',
        duration: 60, coach: null,
      },
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.nextSession!.subject).toBeNull();
    expect(cockpit.nextSession!.coachName).toBeNull();
  });

  it('falls back to the coach full name when no pseudonym is set', async () => {
    mockPayload({
      nextSession: {
        id: 's1', title: 'Séance', subject: 'MATHEMATIQUES', scheduledAt: '2026-09-02T14:00:00.000Z',
        duration: 60, coach: { firstName: 'Alaeddine', lastName: 'Benrhouma', pseudonym: '' },
      },
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.nextSession!.coachName).toBe('Alaeddine Benrhouma');
  });

  it('reports null for every optional student field when absent', async () => {
    mockPayload({
      student: {
        id: 'student-1', firstName: undefined, lastName: undefined, email: 'x@example.test',
        grade: 'TERMINALE', gradeLevel: undefined, academicTrack: undefined, specialties: [],
        stmgPathway: null, survivalMode: false, survivalModeReason: null, school: null,
      },
    });
    const { cockpit } = await buildAriaCockpit('user-1');
    expect(cockpit.student.firstName).toBeNull();
    expect(cockpit.student.lastName).toBeNull();
    expect(cockpit.student.gradeLevel).toBeNull();
    expect(cockpit.student.academicTrack).toBeNull();
  });
});
