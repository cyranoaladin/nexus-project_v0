/**
 * Tests API: GET/POST/PATCH /api/coach/eaf-stage-printemps/students/[studentId]/report
 */

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((result): result is Response => {
    return result !== null && typeof result === 'object' && 'status' in result && typeof (result as Response).json === 'function';
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
    bilan: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { GET, POST, PATCH } from '@/app/api/coach/eaf-stage-printemps/students/[studentId]/report/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  getCoachProfileForUser,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

const mockRequireRole = requireRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;
const mockAssertCoach = assertCoachCanAccessStudent as jest.Mock;
const mockGetCoachProfile = getCoachProfileForUser as jest.Mock;

const SESSION_COACH = { user: { id: 'coach-user-1', role: 'COACH' } };

function makeParams(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_FORM = {
  action: 'draft',
  attendanceAndEngagement: { attendance: 'reguliere', involvement: 4 },
  examExpectations: { understandsWrittenExam: 3 },
  commentary: {},
  dissertation: {},
  writing: {},
  autonomyAndMethod: {},
  progress: { globalProgress: 'nette' },
  parentRecommendations: {},
};

const MOCK_STUDENT = {
  id: 'student-1',
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  school: 'Lycée pilote',
  user: { firstName: 'Ahmed', lastName: 'Ben Ali', email: 'ahmed@test.com' },
};

describe('GET /api/coach/eaf-stage-printemps/students/[studentId]/report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsErrorResponse.mockImplementation(
      (r: unknown) =>
        r !== null && typeof r === 'object' && 'status' in (r as object) && typeof (r as Response).json === 'function'
    );
  });

  it('1. Non connecté → 401', async () => {
    mockRequireRole.mockResolvedValue({ json: () => ({ error: 'Unauthorized' }), status: 401 });

    const res = await GET(new Request('http://localhost/'), makeParams('student-1'));
    expect(res.status).toBe(401);
  });

  it('2. Rôle non COACH → 403', async () => {
    mockRequireRole.mockResolvedValue({ json: () => ({ error: 'Forbidden' }), status: 403 });

    const res = await GET(new Request('http://localhost/'), makeParams('student-1'));
    expect(res.status).toBe(403);
  });

  it('3. Coach non assigné à l\'élève → 403', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockRejectedValue(new CoachNotAssignedError());

    const res = await GET(new Request('http://localhost/'), makeParams('student-1'));
    expect(res.status).toBe(403);
  });

  it('4. Élève non trouvé → 404', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/'), makeParams('student-1'));
    expect(res.status).toBe(404);
  });

  it('5. Accès autorisé — aucun bilan coach existant → coachBilan null', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(MOCK_STUDENT);
    (prisma as any).bilan.findFirst.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/'), makeParams('student-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coachBilan).toBeNull();
    expect(body.student.id).toBe('student-1');
  });

  it('6. Retourne le résumé du questionnaire élève si disponible', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(MOCK_STUDENT);
    (prisma as any).bilan.findFirst
      .mockResolvedValueOnce({ id: 'coach-bilan-1', sourceData: {}, status: 'PENDING', isPublished: false, updatedAt: new Date() })
      .mockResolvedValueOnce({
        id: 'student-bilan-1',
        status: 'COMPLETED',
        updatedAt: new Date(),
        sourceData: {
          answers: {
            beforeStage: { confidence: '3', stress: '4' },
            finalReview: {
              afterConfidence: '4',
              afterStress: '2',
              bestProgress: 'dissertation',
              priorityWork: 'commentaire',
              finalMessage: 'Merci pour le stage !',
            },
          },
        },
      });

    const res = await GET(new Request('http://localhost/'), makeParams('student-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.studentSummary).not.toBeNull();
    expect(body.studentSummary.beforeConfidence).toBe('3');
    expect(body.studentSummary.afterConfidence).toBe('4');
    expect(body.studentSummary.finalMessage).toBe('Merci pour le stage !');
  });
});

describe('POST /api/coach/eaf-stage-printemps/students/[studentId]/report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsErrorResponse.mockImplementation(
      (r: unknown) =>
        r !== null && typeof r === 'object' && 'status' in (r as object) && typeof (r as Response).json === 'function'
    );
  });

  it('7. Non connecté → 401', async () => {
    mockRequireRole.mockResolvedValue({ json: () => ({ error: 'Unauthorized' }), status: 401 });

    const res = await POST(makeRequest(VALID_FORM), makeParams('student-1'));
    expect(res.status).toBe(401);
  });

  it('8. Payload trop volumineux → 413', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': '200000' },
      body: JSON.stringify(VALID_FORM),
    });

    const res = await POST(req, makeParams('student-1'));
    expect(res.status).toBe(413);
  });

  it('9. Coach non assigné → 403', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockRejectedValue(new CoachNotAssignedError());

    const res = await POST(makeRequest(VALID_FORM), makeParams('student-1'));
    expect(res.status).toBe(403);
  });

  it('10. Payload invalide → 400', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });

    const invalidPayload = { action: 'INVALID_ACTION' };
    const res = await POST(makeRequest(invalidPayload), makeParams('student-1'));
    expect(res.status).toBe(400);
  });

  it('11. Création d\'un brouillon pour un élève assigné → 200', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(MOCK_STUDENT);
    (prisma as any).bilan.findFirst.mockResolvedValue(null);
    (prisma as any).bilan.create.mockResolvedValue({
      id: 'new-bilan',
      status: 'PENDING',
      isPublished: false,
    });

    const res = await POST(makeRequest({ ...VALID_FORM, action: 'draft' }), makeParams('student-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.bilan.status).toBe('PENDING');
  });

  it('12. Le coachId est pris de la session (pas du client)', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(MOCK_STUDENT);
    (prisma as any).bilan.findFirst.mockResolvedValue(null);
    (prisma as any).bilan.create.mockResolvedValue({ id: 'bilan-1', status: 'PENDING' });

    // Even if client sends a fake coachId in the form, the server should use the session
    const withFakeCoachId = { ...VALID_FORM, coachId: 'FAKE-COACH-ID' };
    await POST(makeRequest(withFakeCoachId), makeParams('student-1'));

    const createCall = (prisma as any).bilan.create.mock.calls[0][0];
    // coachId must come from server session (coach-1), NOT from client
    expect(createCall.data.coachId).toBe('coach-1');
    expect(createCall.data.coachId).not.toBe('FAKE-COACH-ID');
  });

  it('13. Mise à jour d\'un brouillon existant → update appelé', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(MOCK_STUDENT);
    (prisma as any).bilan.findFirst.mockResolvedValue({
      id: 'existing-bilan',
      status: 'PENDING',
      isPublished: false,
    });
    (prisma as any).bilan.update.mockResolvedValue({
      id: 'existing-bilan',
      status: 'PENDING',
    });

    const res = await POST(makeRequest(VALID_FORM), makeParams('student-1'));

    expect((prisma as any).bilan.update).toHaveBeenCalled();
    expect((prisma as any).bilan.create).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('14. action=complete → status=COMPLETED dans le bilan', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(MOCK_STUDENT);
    (prisma as any).bilan.findFirst.mockResolvedValue(null);
    (prisma as any).bilan.create.mockResolvedValue({ id: 'bilan-1', status: 'COMPLETED' });

    const res = await POST(makeRequest({ ...VALID_FORM, action: 'complete' }), makeParams('student-1'));
    const body = await res.json();

    const createCall = (prisma as any).bilan.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('COMPLETED');
    expect(body.bilan.status).toBe('COMPLETED');
  });

  it('15. Bilan VALIDATED (isPublished=true) → modification refusée (403)', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).student.findUnique.mockResolvedValue(MOCK_STUDENT);
    (prisma as any).bilan.findFirst.mockResolvedValue({
      id: 'bilan-validated',
      status: 'COMPLETED',
      isPublished: true,
    });

    const res = await POST(makeRequest(VALID_FORM), makeParams('student-1'));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/coach/eaf-stage-printemps/students/[studentId]/report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsErrorResponse.mockImplementation(
      (r: unknown) =>
        r !== null && typeof r === 'object' && 'status' in (r as object) && typeof (r as Response).json === 'function'
    );
  });

  it('16. Non connecté → 401', async () => {
    mockRequireRole.mockResolvedValue({ json: () => ({ error: 'Unauthorized' }), status: 401 });

    const res = await PATCH(makeRequest({}, 'PATCH'), makeParams('student-1'));
    expect(res.status).toBe(401);
  });

  it('17. Coach non assigné → 403', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockRejectedValue(new CoachNotAssignedError());

    const res = await PATCH(makeRequest({}, 'PATCH'), makeParams('student-1'));
    expect(res.status).toBe(403);
  });

  it('18. Bilan non trouvé → 404', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findFirst.mockResolvedValue(null);

    const res = await PATCH(makeRequest({}, 'PATCH'), makeParams('student-1'));
    expect(res.status).toBe(404);
  });

  it('19. Bilan en PENDING → ne peut pas être validé (400)', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findFirst.mockResolvedValue({
      id: 'bilan-1',
      status: 'PENDING',
      isPublished: false,
    });

    const res = await PATCH(makeRequest({}, 'PATCH'), makeParams('student-1'));
    expect(res.status).toBe(400);
  });

  it('20. Bilan COMPLETED → validation réussie (isPublished=true)', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockAssertCoach.mockResolvedValue(undefined);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findFirst.mockResolvedValue({
      id: 'bilan-1',
      status: 'COMPLETED',
      isPublished: false,
    });
    (prisma as any).bilan.update.mockResolvedValue({
      id: 'bilan-1',
      status: 'COMPLETED',
      isPublished: true,
      publishedAt: new Date(),
    });

    const res = await PATCH(makeRequest({}, 'PATCH'), makeParams('student-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.bilan.isPublished).toBe(true);

    const updateCall = (prisma as any).bilan.update.mock.calls[0][0];
    expect(updateCall.data.isPublished).toBe(true);
  });
});
