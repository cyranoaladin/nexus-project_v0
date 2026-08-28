/**
 * Route /api/aria/cockpit — payload complet.
 *
 * Le builder RÉEL est exercé : seules les frontières (payload dashboard,
 * profil ARIA) sont simulées. Cela vérifie la règle anti-fake sur des données
 * réalistes.
 */

import { NextResponse } from 'next/server';
import { GET } from '@/app/api/aria/cockpit/route';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { getAriaLearningProfile } from '@/lib/aria/profile/service';

jest.mock('@/lib/guards', () => ({ requireRole: jest.fn(), isErrorResponse: jest.fn() }));
jest.mock('@/lib/dashboard/student-payload', () => ({
  buildStudentDashboardPayload: jest.fn(),
}));
jest.mock('@/lib/aria/profile/service', () => ({ getAriaLearningProfile: jest.fn() }));

const EMPTY_HUB = {
  byCategory: {
    INTERACTIVE_PROGRAM: [],
    OFFICIAL_PROGRAM: [],
    OFFICIAL_AUTOMATISMES: [],
    OFFICIAL_SUJET: [],
    COACH_RESOURCE: [],
    USER_DOCUMENT: [],
    RAG_REFERENCE: [],
    INVOICE: [],
    RECEIPT: [],
    STAGE_BILAN: [],
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
      seanceDuJour: null,
      feuilleDeRoute: [
        {
          id: 'fdr-1',
          type: 'CHAPTER',
          title: 'Revoir les limites',
          estimatedMinutes: 30,
          priority: 1,
          href: '/dashboard/eleve/programme/maths',
          done: false,
        },
        {
          id: 'fdr-2',
          type: 'QCM',
          title: 'QCM dérivation',
          estimatedMinutes: 15,
          priority: 2,
          href: '/dashboard/eleve#qcm',
          done: true,
        },
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
        id: 'bilan-1',
        publicShareId: 'share-1',
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHEMATIQUES',
        subjectLabel: 'Mathématiques',
        status: 'COMPLETED',
        globalScore: 62,
        ssn: null,
        confidenceIndex: null,
        trustLevel: 'high',
        topPriorities: [],
        hasParentsRender: false,
        createdAt: new Date().toISOString(),
        resultUrl: '/bilan-pallier2-maths/resultat/share-1',
      },
    ],
    upcomingStages: [],
    pastStages: [],
    resources: [],
    hub: EMPTY_HUB,
    ariaStats: {
      messagesToday: 4,
      totalConversations: 7,
      canUseAriaMaths: true,
      canUseAriaNsi: false,
    },
    badges: [],
    trajectory: {
      id: 'traj-1',
      title: 'Objectif mention bien',
      progress: 40,
      daysRemaining: 120,
      milestones: [
        {
          id: 'm1',
          title: 'Diagnostic initial',
          description: null,
          targetDate: '2026-09-15',
          status: 'COMPLETED',
          category: 'BILAN',
          completed: true,
          completedAt: '2026-09-10',
        },
        {
          id: 'm2',
          title: 'Bac blanc n°1',
          description: null,
          targetDate: '2026-12-01',
          status: 'UPCOMING',
          category: 'BAC',
          completed: false,
          completedAt: null,
        },
      ],
      nextMilestoneAt: '2026-12-01',
    },
    automatismes: null,
    survivalProgress: null,
    credits: { balance: 5, nonExpiredCount: 5, nextExpiryAt: null },
    ...overrides,
  };
}

function authenticate() {
  (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } });
  (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
}

beforeEach(() => {
  jest.clearAllMocks();
  (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(dashboardPayload());
  (getAriaLearningProfile as jest.Mock).mockResolvedValue({
    targetSession: null,
    selectedCourseKeys: ['maths-terminale-eds'],
    weeklyGoalMinutes: 180,
    learningGoals: ['PREPARER_BAC'],
    preferences: {},
    curriculumVersion: 'v1',
    onboardingCompletedAt: '2026-08-01T10:00:00.000Z',
  });
});

describe('GET /api/aria/cockpit', () => {
  it('propage le refus de la garde de rôle', async () => {
    (requireRole as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    expect((await GET()).status).toBe(401);
    expect(buildStudentDashboardPayload).not.toHaveBeenCalled();
  });

  it("réutilise le payload dashboard à partir de l'userId de session", async () => {
    authenticate();
    await GET();
    expect(buildStudentDashboardPayload).toHaveBeenCalledTimes(1);
    expect(buildStudentDashboardPayload).toHaveBeenCalledWith('user-1');
  });

  it('expose les métriques de performance en en-têtes', async () => {
    authenticate();
    const response = await GET();
    expect(response.headers.get('X-Aria-Cockpit-Query-Count')).toBe('9');
    expect(Number(response.headers.get('X-Aria-Cockpit-Build-Ms'))).not.toBeNaN();
  });

  it('retourne toutes les sections attendues du cockpit', async () => {
    authenticate();
    const body = await (await GET()).json();
    for (const key of [
      'student',
      'setup',
      'profile',
      'curriculum',
      'today',
      'trajectory',
      'resources',
      'assessments',
      'aria',
      'nextSession',
    ]) {
      expect(body).toHaveProperty(key);
    }
    expect(body.setup.state).toBe('READY');
  });

  it("dérive les droits depuis le dashboard, sans seconde résolution d'entitlements", async () => {
    authenticate();
    const body = await (await GET()).json();
    expect(body.curriculum.availableCourseKeys).toContain('maths-terminale-eds');
    expect(body.curriculum.lockedCourseKeys).toContain('nsi-terminale-eds');
  });

  it('projette la feuille de route sans rien inventer', async () => {
    authenticate();
    const body = await (await GET()).json();
    expect(body.today.items).toHaveLength(2);
    expect(body.today.items.every((item: { origin: string }) => item.origin === 'FEUILLE_DE_ROUTE')).toBe(
      true,
    );
    // Seules les 30 min non faites sont comptées.
    expect(body.today.plannedMinutes).toBe(30);
    expect(body.today.weeklyGoalMinutes).toBe(180);
  });

  it('ajoute la séance du jour en tête quand elle existe', async () => {
    authenticate();
    const payload = dashboardPayload();
    payload.cockpit.seanceDuJour = payload.nextSession;
    (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(payload);

    const body = await (await GET()).json();
    expect(body.today.items[0].origin).toBe('NEXT_SESSION');
  });

  it('projette la trajectoire existante sans créer de second modèle', async () => {
    authenticate();
    const body = await (await GET()).json();
    expect(body.trajectory.id).toBe('traj-1');
    expect(body.trajectory.progress).toBe(40);
    expect(body.trajectory.milestoneCount).toBe(2);
    expect(body.trajectory.completedMilestoneCount).toBe(1);
    expect(body.trajectory.nextMilestone.title).toBe('Bac blanc n°1');
  });

  it('classe un bilan analysé récent comme RECENT avec son score réel', async () => {
    authenticate();
    const body = await (await GET()).json();
    expect(body.assessments).toHaveLength(1);
    expect(body.assessments[0].state).toBe('RECENT');
    expect(body.assessments[0].globalScore).toBe(62);
  });

  it('ne fabrique aucun score quand le bilan n’en a pas', async () => {
    authenticate();
    const payload = dashboardPayload();
    payload.recentBilans[0].globalScore = null;
    payload.recentBilans[0].status = 'PENDING';
    (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(payload);

    const body = await (await GET()).json();
    expect(body.assessments[0].globalScore).toBeNull();
    expect(body.assessments[0].state).toBe('A_FAIRE');
  });

  it('laisse RAG_REFERENCE vide et n’invente aucune citation', async () => {
    authenticate();
    const body = await (await GET()).json();
    const ragRefs = body.resources.filter(
      (resource: { category: string }) => resource.category === 'RAG_REFERENCE',
    );
    expect(ragRefs).toHaveLength(0);
  });

  it('exclut les factures et reçus des ressources pédagogiques', async () => {
    authenticate();
    const payload = dashboardPayload();
    payload.hub.byCategory.INVOICE = [
      { id: 'inv-1', category: 'INVOICE', title: 'Facture', type: 'PDF' },
    ] as never;
    (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(payload);

    const body = await (await GET()).json();
    expect(
      body.resources.some((resource: { category: string }) => resource.category === 'INVOICE'),
    ).toBe(false);
  });

  it('embarque les graphes de compétences des seuls cours de la carte', async () => {
    authenticate();
    const body = await (await GET()).json();
    const keys = body.skillGraphs.map((graph: { courseKey: string }) => graph.courseKey);
    expect(keys).toContain('maths-terminale-eds');
    expect(keys).toContain('nsi-terminale-eds');
    expect(keys).not.toContain('sgn-premiere-stmg');
  });

  it("signale ONBOARDING_REQUIRED tant que l'onboarding n'est pas terminé", async () => {
    authenticate();
    (getAriaLearningProfile as jest.Mock).mockResolvedValue({
      targetSession: null,
      selectedCourseKeys: [],
      weeklyGoalMinutes: 180,
      learningGoals: [],
      preferences: {},
      curriculumVersion: 'v1',
      onboardingCompletedAt: null,
    });

    const body = await (await GET()).json();
    expect(body.setup.state).toBe('ONBOARDING_REQUIRED');
    expect(body.setup.academicProfileReadOnly).toBe(true);
  });

  it('signale NO_COURSE_SELECTED après onboarding sans sélection', async () => {
    authenticate();
    (getAriaLearningProfile as jest.Mock).mockResolvedValue({
      targetSession: null,
      selectedCourseKeys: [],
      weeklyGoalMinutes: 180,
      learningGoals: [],
      preferences: {},
      curriculumVersion: 'v1',
      onboardingCompletedAt: '2026-08-01T10:00:00.000Z',
    });

    const body = await (await GET()).json();
    expect(body.setup.state).toBe('NO_COURSE_SELECTED');
  });

  it("retourne un contexte d'examen nul quand aucune session n'est visée", async () => {
    authenticate();
    const body = await (await GET()).json();
    expect(body.examContext).toBeNull();
  });

  it('retourne 500 sans fuite si le payload dashboard échoue', async () => {
    authenticate();
    (buildStudentDashboardPayload as jest.Mock).mockRejectedValue(new Error('boom'));
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('boom');
  });
});
