/**
 * Tests API: POST/GET/PATCH /api/coach/maths-premiere-stage-printemps/students/[studentId]/report
 *
 * Regression tests covering the 400 Bad Request bug caused by Zod max() limits
 * being too restrictive for real coach free-text inputs.
 */

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((result): result is Response => {
    return (
      result !== null &&
      typeof result === 'object' &&
      'status' in result &&
      typeof (result as Response).json === 'function'
    );
  }),
}));

jest.mock('@/lib/rbac/coach-student-access', () => {
  class CoachNotAssignedError extends Error {
    constructor(msg = "Vous n'êtes pas assigné à cet élève") {
      super(msg);
      this.name = 'CoachNotAssignedError';
    }
  }
  return {
    assertCoachCanAccessStudent: jest.fn(),
    getCoachProfileForUser: jest.fn(),
    CoachNotAssignedError,
  };
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    bilan: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { POST, GET, PATCH } from '@/app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { assertCoachCanAccessStudent, getCoachProfileForUser } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

const mockRequireRole = requireRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;
const mockAssertCoach = assertCoachCanAccessStudent as jest.Mock;
const mockGetCoachProfile = getCoachProfileForUser as jest.Mock;

const SESSION_COACH = { user: { id: 'coach-user-1', role: 'COACH' } };

function makeParams(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const MOCK_STUDENT = {
  id: 'student-1',
  user: { firstName: 'Melik', lastName: 'Zayane', email: 'melik@test.com' },
};

function setupMocks(existingBilan: unknown = null) {
  mockRequireRole.mockResolvedValue(SESSION_COACH);
  mockIsErrorResponse.mockImplementation(
    (r: unknown) =>
      r !== null &&
      typeof r === 'object' &&
      'status' in (r as object) &&
      typeof (r as Response).json === 'function'
  );
  mockAssertCoach.mockResolvedValue(undefined);
  mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
  (prisma as any).student.findUnique.mockResolvedValue(MOCK_STUDENT);
  (prisma as any).bilan.findFirst.mockResolvedValue(existingBilan);
  (prisma as any).bilan.create.mockResolvedValue({ id: 'bilan-new', status: 'PENDING' });
  (prisma as any).bilan.update.mockResolvedValue({ id: 'bilan-existing', status: 'PENDING' });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Regression: long text fields that caused 400 in prod
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/coach/maths-premiere-stage-printemps/students/[studentId]/report', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('accepts empty draft payload with only action', async () => {
    setupMocks();
    const res = await POST(makeRequest('POST', { action: 'draft' }), makeParams('student-1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  // ── REGRESSION: methodsAcquired items >100 chars used to fail with 400 ──
  it('[REGRESSION] accepts methodsAcquired items longer than 100 chars', async () => {
    setupMocks();
    const longItem = 'Bien maîtriser la dérivée d\'un produit en appliquant la formule correctement, en vérifiant les conditions de dérivabilité sur l\'intervalle et en détaillant toutes les étapes du calcul';
    expect(longItem.length).toBeGreaterThan(100);

    const res = await POST(
      makeRequest('POST', {
        action: 'draft',
        chapterDiagnostics: {
          derivation: {
            mastery: 3,
            methodsAcquired: [longItem],
            vigilancePoints: ['Oublie parfois de vérifier si la fonction est bien dérivable sur l\'intervalle donné avant de commencer le calcul de la dérivée'],
            recurringErrors: ['Confusion entre dérivée d\'un produit et dérivée d\'une somme lors de calculs complexes impliquant plusieurs opérations'],
          },
        },
      }),
      makeParams('student-1')
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  // ── REGRESSION: mainCoachMessage >300 chars used to fail with 400 ──
  it('[REGRESSION] accepts mainCoachMessage longer than 300 chars', async () => {
    setupMocks();
    const longMsg = 'L\'élève a montré une progression remarquable sur les chapitres de dérivation et de second degré, mais reste fragile sur les probabilités conditionnelles et les suites numériques. Il faut continuer le travail sur la rigueur rédactionnelle et la gestion du temps lors des épreuves. Avec de la régularité, les résultats devraient s\'améliorer significativement d\'ici les examens de spécialité mathématiques de Première.';
    expect(longMsg.length).toBeGreaterThan(300);

    const res = await POST(
      makeRequest('POST', { action: 'draft', globalDiagnostic: { mainCoachMessage: longMsg } }),
      makeParams('student-1')
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  // ── REGRESSION: revealingExercise / priorityRemediation >250 chars ──
  it('[REGRESSION] accepts revealingExercise and priorityRemediation longer than 250 chars', async () => {
    setupMocks();
    const longRemediation = 'Il faut absolument retravailler la méthode de résolution des équations du second degré en insistant sur le calcul du discriminant, la discussion selon le signe, et la vérification des solutions dans l\'équation originale. Des exercices quotidiens de 15 minutes sont recommandés.';
    expect(longRemediation.length).toBeGreaterThan(250);

    const res = await POST(
      makeRequest('POST', {
        action: 'draft',
        chapterDiagnostics: {
          secondDegree: {
            mastery: 2,
            revealingExercise: 'Exercice sur la résolution d\'une équation du second degré avec paramètre k, demandant une discussion complète selon les valeurs du paramètre et une vérification systématique de toutes les solutions trouvées dans chaque cas.',
            priorityRemediation: longRemediation,
          },
        },
      }),
      makeParams('student-1')
    );
    expect(res.status).toBe(200);
  });

  // ── REGRESSION: parentMainMessage >300 chars and parentDoNotSay >200 chars ──
  it('[REGRESSION] accepts parentMainMessage >300 and parentDoNotSay >200 chars', async () => {
    setupMocks();
    const longParentMsg = 'Votre enfant a bien travaillé durant ce stage intensif et a montré une réelle volonté de progresser en mathématiques. Nous recommandons vivement de continuer les exercices réguliers à la maison, en particulier sur les probabilités conditionnelles. Un suivi ponctuel serait très bénéfique avant les épreuves de spécialité.';
    expect(longParentMsg.length).toBeGreaterThan(300);

    const longDoNotSay = 'Ne pas mentionner les mauvaises notes obtenues en classe durant l\'année scolaire, ni faire de comparaison négative avec d\'autres élèves de la classe, ni remettre en question les méthodes pédagogiques des professeurs du lycée.';
    expect(longDoNotSay.length).toBeGreaterThan(200);

    const res = await POST(
      makeRequest('POST', {
        action: 'draft',
        parentRecommendations: {
          parentTone: 'BALANCED',
          parentUrgency: 'WATCH',
          parentMainMessage: longParentMsg,
          parentDoNotSay: longDoNotSay,
        },
      }),
      makeParams('student-1')
    );
    expect(res.status).toBe(200);
  });

  it('accepts a complete realistic full-form payload', async () => {
    setupMocks();

    const res = await POST(
      makeRequest('POST', {
        action: 'complete',
        attendanceAndEngagement: {
          attendance: 'reguliere',
          punctuality: 'satisfaisante',
          involvement: 5,
          concentration: 4,
          coachComment: 'Très bon engagement tout au long du stage',
        },
        automatismes: {
          calculationFluency: 4,
          identities: 3,
          linearEquation: 4,
          derivatives: 3,
          strongestAutomation: 'Calcul de dérivées simples',
          weakestAutomation: 'Identités remarquables moins automatiques',
        },
        analysis: { productDerivative: 3, quotientDerivative: 2, variationTable: 4, exponentialPositivity: 3 },
        sequences: { explicitFormula: 3, auxiliarySequence: 2, sums: 2 },
        scalarProduct: { coordinates: 3, alKashi: 2 },
        probabilities: { weightedTree: 2, totalProbability: 2, bayes: 1, independenceVsIncompatibility: 2, conditionalProbabilityFormula: 2 },
        finalAssessment: {
          finalTestDone: 'DONE',
          approximateScore: 11,
          timeManagement: 4,
          writtenJustification: 2,
          methodSelection: 3,
          resilience: 3,
          mostAvoidableMistake: 'Oubli de la formule de Bayes lors du calcul des probabilités conditionnelles composées, ce qui a entraîné une perte de plusieurs points',
          strongestFinalTestPoint: 'Bonne gestion du temps et organisation claire de la copie avec une présentation soignée',
          priorityBeforeExam: 'Retravailler les probabilités conditionnelles avec la formule de Bayes sur des exercices type bac en condition chrono',
        },
        globalDiagnostic: {
          overallProfile: 'STEADY_PROGRESS',
          workPace: 'FAST_BUT_CARELESS',
          errorManagement: 'ACCEPTS_HELP',
          autonomyLevel: 'NEEDS_PROMPTS',
          confidenceLevel: 'HESITANT',
          mainCoachMessage: 'Élève sérieux avec une bonne base en dérivation et second degré. Les probabilités conditionnelles restent le point faible majeur à travailler en priorité avant les épreuves de spécialité mathématiques.',
        },
        parentRecommendations: {
          estimatedCurrentLevel: 'fragile-mais-en-progres',
          recommendedFollowUp: 'accompagnement-regulier',
          parentTone: 'BALANCED',
          parentUrgency: 'WATCH',
          parentMainMessage: 'Votre enfant progresse bien mais nécessite un suivi régulier ciblé sur les probabilités et la rédaction.',
          parentDoNotSay: 'Ne pas évoquer les notes du lycée ni comparer avec les autres élèves.',
          priorityAxes: ['second-degre', 'probabilites-conditionnelles', 'redaction-justification'],
        },
        chapterDiagnostics: {
          secondDegree: {
            mastery: 4,
            methodsAcquired: ['Discriminant', 'Factorisation par alpha', 'Forme canonique'],
            vigilancePoints: ['Signe du coefficient a dans le tableau de signes', 'Double vérification des solutions'],
            strength: 'Résolution d\'équations du second degré bien maîtrisée avec méthode claire',
          },
          probabilities: {
            mastery: 1,
            vigilancePoints: ['P(A|B) confondue avec P(A et B)', 'Formule de Bayes mal mémorisée lors des calculs composés'],
            recurringErrors: ['Inversion numérateur/dénominateur dans P(A|B)', 'Oubli de la condition de normalisation de la probabilité totale'],
            priorityRemediation: 'Refaire systématiquement les exercices de probabilités conditionnelles en commençant par les arbres pondérés avant les formules de Bayes, 15 min par jour.',
          },
        },
      }),
      makeParams('student-1')
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 400 with Zod details when action is missing', async () => {
    setupMocks();
    const res = await POST(
      makeRequest('POST', { globalDiagnostic: { mainCoachMessage: 'Sans action' } }),
      makeParams('student-1')
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(body.details).toBeDefined();
  });

  it('returns 403 when coach not assigned to student', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockIsErrorResponse.mockImplementation(() => false);
    const { CoachNotAssignedError } = jest.requireMock('@/lib/rbac/coach-student-access');
    mockAssertCoach.mockRejectedValue(new CoachNotAssignedError());

    const res = await POST(makeRequest('POST', { action: 'draft' }), makeParams('other-student'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when bilan is already validated+published', async () => {
    setupMocks({ id: 'bilan-locked', status: 'COMPLETED', isPublished: true });
    const res = await POST(makeRequest('POST', { action: 'complete' }), makeParams('student-1'));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Locked');
  });

  it('updates existing draft bilan without creating a new one', async () => {
    setupMocks({ id: 'bilan-existing', status: 'PENDING', isPublished: false });
    (prisma as any).bilan.update.mockResolvedValue({ id: 'bilan-existing', status: 'PENDING' });

    const res = await POST(
      makeRequest('POST', { action: 'draft', globalDiagnostic: { mainCoachMessage: 'Mise à jour' } }),
      makeParams('student-1')
    );
    expect(res.status).toBe(200);
    expect((prisma as any).bilan.update).toHaveBeenCalled();
    expect((prisma as any).bilan.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/coach/maths-premiere-stage-printemps/students/[studentId]/report', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns student data and coachBilan', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockIsErrorResponse.mockImplementation(() => false);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });

    (prisma as any).student.findUnique.mockResolvedValue({
      ...MOCK_STUDENT,
      gradeLevel: 'Première',
      academicTrack: 'Générale',
      school: 'Lycée Test',
    });
    (prisma as any).bilan.findFirst
      .mockResolvedValueOnce({ id: 'bilan-1', sourceData: {}, status: 'PENDING' })
      .mockResolvedValueOnce(null);

    const res = await GET(new Request('http://localhost/'), makeParams('student-1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.student).toBeDefined();
    expect(body.student.firstName).toBe('Melik');
    expect(body.student).not.toHaveProperty('email');
    expect(body.coachBilan).toBeDefined();
    expect(body.studentSummary).toBeNull();
  });

  it('ne retourne pas l’email élève dans la projection coach', async () => {
    setupMocks(null);
    (prisma as any).bilan.findFirst.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/'), makeParams('student-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.student.firstName).toBe('Melik');
    expect(body.student).not.toHaveProperty('email');
    expect(JSON.stringify(body)).not.toContain('melik@test.com');
  });

  it('returns 404 when student not found', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockIsErrorResponse.mockImplementation(() => false);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/'), makeParams('nonexistent'));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — validate bilan
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/coach/maths-premiere-stage-printemps/students/[studentId]/report', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('publishes a COMPLETED bilan', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockIsErrorResponse.mockImplementation(() => false);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue({ academicTrack: 'EDS_GENERALE' });
    (prisma as any).bilan.findFirst.mockResolvedValue({ id: 'bilan-1', status: 'COMPLETED', isPublished: false });
    (prisma as any).bilan.update.mockResolvedValue({ id: 'bilan-1', isPublished: true });

    const res = await PATCH(new Request('http://localhost/', { method: 'PATCH' }), makeParams('student-1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect((prisma as any).bilan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isPublished: true }) })
    );
  });

  it('returns 400 when bilan is not yet COMPLETED', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockIsErrorResponse.mockImplementation(() => false);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue({ academicTrack: 'EDS_GENERALE' });
    (prisma as any).bilan.findFirst.mockResolvedValue({ id: 'bilan-1', status: 'PENDING', isPublished: false });

    const res = await PATCH(new Request('http://localhost/', { method: 'PATCH' }), makeParams('student-1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when no bilan exists', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockIsErrorResponse.mockImplementation(() => false);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue({ academicTrack: 'EDS_GENERALE' });
    (prisma as any).bilan.findFirst.mockResolvedValue(null);

    const res = await PATCH(new Request('http://localhost/', { method: 'PATCH' }), makeParams('student-1'));
    expect(res.status).toBe(404);
  });
});
