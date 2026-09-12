/**
 * Tâche 11 — POST /api/assistante/sessions matérialise une PlanningSeries
 * gouvernée. `materializePlanningSeries`/`verifyPlanningInvariants` (Tâches
 * 10-11) tournent RÉELLEMENT ici, contre un client de transaction simulé —
 * seuls `@/lib/guards` et `@/lib/prisma` sont mockés. Reprend le fixture
 * `eds-maths-premiere` déjà validé par __tests__/lib/planning/series.test.ts.
 */
import { Prisma } from '@prisma/client';
import { POST } from '@/app/api/assistante/sessions/route';
import { DELETE, PUT } from '@/app/api/assistante/planning/series/[seriesId]/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));

const STUDENT_PROFILE_ID = 'clh1234567890abcdefghij';
const COACH_PROFILE_ID = 'clh1234567890abcdefghik';
const ASSIGNMENT_ID = 'clh1234567890abcdefghil';
const COURSE_KEY = 'eds-maths-premiere';

function makeRequest(body: unknown) {
  return { json: async () => body } as any;
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    studentProfileId: STUDENT_PROFILE_ID,
    coachProfileId: COACH_PROFILE_ID,
    assignmentId: ASSIGNMENT_ID,
    academicCourseKey: COURSE_KEY,
    scheduledDate: '2026-03-09', // lundi
    startTime: '09:00',
    endTime: '10:00',
    duration: 60,
    title: 'Séance de mathématiques',
    ...overrides,
  };
}

function buildFakeTx(overrides: { coachSubjects?: string[] } = {}) {
  const createdByKey = new Map<string, any>();
  return {
    student: {
      findUnique: jest.fn().mockResolvedValue({
        id: STUDENT_PROFILE_ID,
        userId: 'student-user-1',
        gradeLevel: 'PREMIERE',
        academicTrack: 'EDS_GENERALE',
        stmgPathway: null,
        parent: { userId: 'parent-user-1' },
      }),
    },
    coachProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: COACH_PROFILE_ID,
        userId: 'coach-user-1',
        subjects: overrides.coachSubjects ?? ['MATHEMATIQUES'],
      }),
    },
    coachStudentAssignment: {
      findUnique: jest.fn().mockResolvedValue({
        id: ASSIGNMENT_ID,
        studentId: STUDENT_PROFILE_ID,
        coachId: COACH_PROFILE_ID,
        status: 'ACTIVE',
        startsAt: new Date('2026-01-01T00:00:00Z'),
        endsAt: null,
        academicCourseKeys: [COURSE_KEY],
      }),
    },
    studentAcademicEnrollment: {
      findMany: jest.fn().mockResolvedValue([{ courseKey: COURSE_KEY, kind: 'SPECIALTY', source: 'ADMIN' }]),
    },
    coachAvailability: {
      // Une ligne récurrente PAR jour de semaine : les tests d'édition de
      // série calculent leur planning futur à partir d'« aujourd'hui »
      // (horloge réelle, clampée par la route future-only), donc le jour de
      // semaine réel dépend de la date d'exécution des tests — cette fixture
      // reste correcte quel que soit ce jour.
      findMany: jest.fn().mockResolvedValue(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
          specificDate: null,
          isAvailable: true,
          isRecurring: true,
          validFrom: new Date('2020-01-01T00:00:00Z'),
          validUntil: null,
        })),
      ),
    },
    sessionBooking: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `booking-${data.occurrenceKey}`,
          scheduledDate: data.scheduledDate,
          startTime: data.startTime,
          endTime: data.endTime,
          occurrenceKey: data.occurrenceKey,
          data,
        };
        createdByKey.set(data.occurrenceKey, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => createdByKey.get(where.occurrenceKey) ?? null),
    },
    stageReservation: { findMany: jest.fn().mockResolvedValue([]) },
    stageSession: { findMany: jest.fn().mockResolvedValue([]) },
    planningSeries: {
      create: jest.fn().mockResolvedValue({ id: 'series-1' }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'series-1',
        studentProfileId: STUDENT_PROFILE_ID,
        coachProfileId: COACH_PROFILE_ID,
        assignmentId: ASSIGNMENT_ID,
        academicCourseKey: COURSE_KEY,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: 'series-1' }),
    },
    planningOverrideAudit: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    createdByKey,
  };
}

function makeJsonRequest(body: unknown) {
  return {
    json: async () => body,
    text: async () => JSON.stringify(body ?? {}),
  } as any;
}

describe('POST /api/assistante/sessions — Tâche 11', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
  });

  function mockRoleAndTx(role: 'ADMIN' | 'ASSISTANTE', tx: ReturnType<typeof buildFakeTx>) {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role, id: `${role.toLowerCase()}-1` } });
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));
  }

  it('matérialise une occurrence unique gouvernée avec creditsUsed=0 explicite', async () => {
    const tx = buildFakeTx();
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await POST(makeRequest(baseBody()));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.seriesId).toBe('series-1');
    expect(json.sessions).toHaveLength(1);

    expect(tx.sessionBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          creditsUsed: 0,
          studentId: 'student-user-1',
          coachId: 'coach-user-1',
          parentId: 'parent-user-1',
          studentProfileId: STUDENT_PROFILE_ID,
          coachProfileId: COACH_PROFILE_ID,
          assignmentId: ASSIGNMENT_ID,
          academicCourseKey: COURSE_KEY,
          subject: 'MATHEMATIQUES',
          planningSeriesId: 'series-1',
        }),
      }),
    );
  });

  it('matérialise une série récurrente hebdomadaire', async () => {
    const tx = buildFakeTx();
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await POST(
      makeRequest(baseBody({ recurrence: { frequency: 'WEEKLY', intervalWeeks: 1, count: 3 } })),
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.sessions).toHaveLength(3);
    expect(new Set(json.sessions.map((s: any) => s.occurrenceKey)).size).toBe(3);
  });

  it('bloque toujours un conflit, même sans dérogation demandée (409)', async () => {
    const tx = buildFakeTx();
    tx.sessionBooking.findMany.mockResolvedValueOnce([
      { scheduledDate: new Date('2026-03-09T00:00:00Z'), startTime: '09:00', endTime: '10:00' },
    ]);
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await POST(makeRequest(baseBody()));
    expect(response.status).toBe(409);
    expect(tx.sessionBooking.create).not.toHaveBeenCalled();
  });

  it('rejette une dérogation fournie par ASSISTANTE (403), avant toute écriture', async () => {
    const tx = buildFakeTx();
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await POST(
      makeRequest(
        baseBody({ override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'Test injection ASSISTANTE' } }),
      ),
    );
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ADMIN avec dérogation COACH_CAPABILITY_NOT_DECLARED laisse passer et journalise un audit', async () => {
    const tx = buildFakeTx({ coachSubjects: ['NSI'] });
    mockRoleAndTx('ADMIN', tx);

    const response = await POST(
      makeRequest(
        baseBody({ override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'Capacité confirmée par le staff' } }),
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.sessions).toHaveLength(1);
    expect(tx.planningOverrideAudit.create).toHaveBeenCalledTimes(1);
  });

  it('sans dérogation, une capacité coach manquante échoue en 400 (ASSISTANTE)', async () => {
    const tx = buildFakeTx({ coachSubjects: ['NSI'] });
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await POST(makeRequest(baseBody()));
    expect(response.status).toBe(400);
    expect(tx.sessionBooking.create).not.toHaveBeenCalled();
  });

  it('rejette un academicCourseKey sans matière historique (400)', async () => {
    const tx = buildFakeTx();
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await POST(makeRequest(baseBody({ academicCourseKey: 'course-inexistant' })));
    expect(response.status).toBe(400);
  });

  it('convertit une violation d’exclusion PostgreSQL (23P01) en 409 stable', async () => {
    // Prisma ne mappe PAS 23P01 sur un code connu : elle surgit comme
    // PrismaClientUnknownRequestError, SANS `.code` — seul le message la
    // porte (vérifié empiriquement contre un vrai Postgres jetable, voir
    // lib/planning/series.ts:isPlanningConflictDatabaseError). Reproduit ici
    // le SEUL signal réellement disponible : le message.
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE', id: 'assistante-1' } });
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientUnknownRequestError(
        'conflicting key value violates exclusion constraint "SessionBooking_no_overlap_excl" ... 23P01',
        { clientVersion: '5.x' },
      ),
    );

    const response = await POST(makeRequest(baseBody()));
    expect(response.status).toBe(409);
  });

  it('convertit un échec de sérialisation (P2034) en 409 stable', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE', id: 'assistante-1' } });
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.x',
      }),
    );

    const response = await POST(makeRequest(baseBody()));
    expect(response.status).toBe(409);
  });

  // Real CI event (Integration run 34529418191, 2026-09-10): two concurrent
  // creations of the same slot ended in a Postgres deadlock that Prisma
  // surfaced RAW (PrismaClientUnknownRequestError, no `.code`, SQLSTATE only
  // in the message) — the route answered 500 instead of the stable 409.
  it.each([
    ['40P01 deadlock detected', 'Error occurred during query execution: ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40P01", message: "deadlock detected", severity: "ERROR" }) })'],
    ['40001 serialization failure', 'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40001", message: "could not serialize access due to read/write dependencies among transactions", severity: "ERROR" }) })'],
  ])('convertit un conflit brut %s (sans code Prisma) en 409 stable', async (_label, message) => {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE', id: 'assistante-1' } });
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientUnknownRequestError(message, { clientVersion: '5.x' }),
    );

    const response = await POST(makeRequest(baseBody()));
    expect(response.status).toBe(409);
  });

  it('rejette plus de 104 occurrences dès la validation (400)', async () => {
    const tx = buildFakeTx();
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await POST(
      makeRequest(baseBody({ recurrence: { frequency: 'WEEKLY', intervalWeeks: 1, count: 200 } })),
    );
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/assistante/planning/series/[seriesId] — annulation future-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
  });

  function mockRoleAndTx(role: 'ADMIN' | 'ASSISTANTE', tx: ReturnType<typeof buildFakeTx>) {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role, id: `${role.toLowerCase()}-1` } });
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));
  }

  it('annule uniquement les occurrences futures actives et marque la série CANCELLED', async () => {
    const tx = buildFakeTx();
    tx.sessionBooking.updateMany.mockResolvedValue({ count: 2 });
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await DELETE(makeJsonRequest({ reason: 'Famille indisponible' }), {
      params: Promise.resolve({ seriesId: 'series-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.cancelledCount).toBe(2);
    expect(tx.sessionBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          planningSeriesId: 'series-1',
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        }),
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
    expect(tx.planningSeries.update).toHaveBeenCalledWith({
      where: { id: 'series-1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('404 quand la série est introuvable', async () => {
    const tx = buildFakeTx();
    tx.planningSeries.findUnique.mockResolvedValue(null);
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await DELETE(makeJsonRequest({}), { params: Promise.resolve({ seriesId: 'missing' }) });
    expect(response.status).toBe(404);
  });

  it(
    'à 23:30 UTC (00:30 Tunis, jour calendaire déjà basculé), la frontière future-only est ' +
      "minuit Tunis (2026-09-08T00:00:00Z) — PAS minuit UTC (2026-09-07T00:00:00Z), sous peine " +
      "de traiter une occurrence du 2026-09-07 (Tunis-hier, déjà écoulée) comme encore future",
    async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-07T23:30:00.000Z'));
      try {
        const tx = buildFakeTx();
        tx.sessionBooking.updateMany.mockResolvedValue({ count: 0 });
        mockRoleAndTx('ASSISTANTE', tx);

        await DELETE(makeJsonRequest({}), { params: Promise.resolve({ seriesId: 'series-1' }) });

        expect(tx.sessionBooking.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              scheduledDate: { gte: new Date('2026-09-08T00:00:00.000Z') },
            }),
          }),
        );
      } finally {
        jest.useRealTimers();
      }
    },
  );
});

describe('PUT /api/assistante/planning/series/[seriesId] — édition future-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
  });

  function mockRoleAndTx(role: 'ADMIN' | 'ASSISTANTE', tx: ReturnType<typeof buildFakeTx>) {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role, id: `${role.toLowerCase()}-1` } });
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));
  }

  function editBody(overrides: Record<string, unknown> = {}) {
    return {
      expectedRevision: 0,
      startDate: '2026-03-09',
      localStartTime: '09:00',
      localEndTime: '10:00',
      duration: 60,
      title: 'Séance révisée',
      recurrence: { frequency: 'WEEKLY', intervalWeeks: 1, count: 2 },
      ...overrides,
    };
  }

  it('CAS réussi : annule le futur existant puis rematérialise, révision incrémentée', async () => {
    const tx = buildFakeTx();
    tx.sessionBooking.count.mockResolvedValue(3); // 3 occurrences déjà matérialisées pour cette série
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await PUT(makeJsonRequest(editBody()), { params: Promise.resolve({ seriesId: 'series-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.revision).toBe(1);
    expect(json.sessions).toHaveLength(2);
    expect(json.sessions.map((s: any) => s.occurrenceKey)).toEqual(['series-1:3', 'series-1:4']);

    expect(tx.planningSeries.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'series-1', revision: 0 }, data: expect.objectContaining({ revision: 1 }) }),
    );
    expect(tx.sessionBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
    );
  });

  it('409 PLANNING_SERIES_REVISION_CONFLICT quand la révision est périmée', async () => {
    const tx = buildFakeTx();
    tx.planningSeries.updateMany.mockResolvedValue({ count: 0 });
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await PUT(makeJsonRequest(editBody({ expectedRevision: 5 })), {
      params: Promise.resolve({ seriesId: 'series-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe('PLANNING_SERIES_REVISION_CONFLICT');
    expect(tx.sessionBooking.updateMany).not.toHaveBeenCalled();
  });

  it('404 quand la série est introuvable', async () => {
    const tx = buildFakeTx();
    tx.planningSeries.findUnique.mockResolvedValue(null);
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await PUT(makeJsonRequest(editBody()), { params: Promise.resolve({ seriesId: 'missing' }) });
    expect(response.status).toBe(404);
  });

  it('rejette une dérogation fournie par ASSISTANTE (403)', async () => {
    const tx = buildFakeTx();
    mockRoleAndTx('ASSISTANTE', tx);

    const response = await PUT(
      makeJsonRequest(editBody({ override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'Test' } })),
      { params: Promise.resolve({ seriesId: 'series-1' }) },
    );
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
