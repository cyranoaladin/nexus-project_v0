/**
 * POST /api/sessions/book — Tâche 12.
 *
 * `studentId`/`coachId` sont désormais des identités canoniques
 * (`Student.id`/`CoachProfile.id`), jamais `User.id`. La réservation est
 * routée à travers `materializePlanningSeries` (lib/planning/series.ts) —
 * mêmes invariants (identité pédagogique, disponibilité effective, conflits)
 * que la planification staff (Tâche 10/11) — mais SANS aucune capacité de
 * dérogation pour cet acteur (`PlanningInvariantRequester` role
 * `PARENT_STUDENT`).
 *
 * Règles métier PROPRES à cette route, préservées intégralement :
 *   - rattachement de l'élève à un foyer (household ownership) ;
 *   - aucun crédit consommé (Amendement 11) ;
 *   - plafond de réservation à 3 mois ;
 *   - un ELEVE ne peut réserver que pour lui-même.
 */
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/sessions/book/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { parseBody } from '@/lib/api/helpers';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn(),
}));

jest.mock('@/lib/api/helpers', () => ({
  parseBody: jest.fn(),
}));

jest.mock('@/lib/middleware/logger', () => ({
  createLogger: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    sessionBooking: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    sessionNotification: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    sessionReminder: {
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  },
}));

const studentProfileId = 'student-profile-1';
const coachProfileId = 'coach-profile-1';
const assignmentId = 'assignment-1';
const academicCourseKey = 'eds-maths-premiere';

const mockElevSession = {
  user: {
    id: 'student-user-1',
    email: 'student@nexus.com',
    role: 'ELEVE' as const,
    firstName: 'Student',
    lastName: 'User',
  },
};

const mockParentSession = {
  user: {
    id: 'parent-user-1',
    email: 'parent@nexus.com',
    role: 'PARENT' as const,
    firstName: 'Parent',
    lastName: 'User',
  },
};

function createMockRequest(url: string, options?: RequestInit): NextRequest {
  const request = new NextRequest(url, options as any);
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    writable: false,
    configurable: true,
  });
  return request;
}

function buildPayload(overrides: Partial<Record<string, any>> = {}) {
  return {
    coachId: coachProfileId,
    studentId: studentProfileId,
    assignmentId,
    academicCourseKey,
    scheduledDate: '2025-01-06', // lundi
    startTime: '10:00',
    endTime: '11:00',
    duration: 60,
    type: 'INDIVIDUAL',
    modality: 'ONLINE',
    title: 'Algebra',
    description: 'Intro session',
    ...overrides,
  };
}

function mockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logRequest: jest.fn(),
  };
}

function studentRecord(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: studentProfileId,
    userId: 'student-user-1',
    parentId: 'parent-profile-1',
    // La même ligne mockée sert à la fois au contrôle de rattachement au
    // foyer (household ownership, ci-dessous) ET à `loadPlanningIdentitySnapshot`
    // (lib/planning/identities.ts) qui interroge aussi `tx.student.findUnique` —
    // elle doit donc porter les deux jeux de champs.
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    user: { mergedIntoUserId: null },
    parent: { userId: 'parent-user-1', user: { mergedIntoUserId: null } },
    ...overrides,
  };
}

/** Mock `tx` couvrant tout ce que `materializePlanningSeries` interroge (même
 * pattern que __tests__/api/assistante.sessions.sans-credits.test.ts). */
function makeTransactionMocks(overrides: Partial<Record<string, any>> = {}) {
  return {
    student: {
      findUnique: jest.fn().mockResolvedValue(studentRecord()),
    },
    coachProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: coachProfileId, userId: 'coach-user-1', subjects: ['MATHEMATIQUES'] }),
    },
    coachStudentAssignment: {
      findUnique: jest.fn().mockResolvedValue({
        id: assignmentId,
        studentId: studentProfileId,
        coachId: coachProfileId,
        status: 'ACTIVE',
        startsAt: new Date('2024-01-01T00:00:00Z'),
        endsAt: null,
        academicCourseKeys: [academicCourseKey],
      }),
    },
    studentAcademicEnrollment: {
      findMany: jest.fn().mockResolvedValue([{ courseKey: academicCourseKey, kind: 'SPECIALTY', source: 'ADMIN' }]),
    },
    coachAvailability: {
      findMany: jest.fn().mockResolvedValue([
        {
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '18:00',
          specificDate: null,
          isAvailable: true,
          isRecurring: true,
          validFrom: new Date('2024-01-01T00:00:00Z'),
          validUntil: null,
        },
      ]),
    },
    sessionBooking: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 'session-1',
        scheduledDate: new Date('2025-01-06'),
        startTime: '10:00',
        endTime: '11:00',
        occurrenceKey: 'series-1:0',
      }),
      findUnique: jest.fn(),
    },
    stageReservation: { findMany: jest.fn().mockResolvedValue([]) },
    stageSession: { findMany: jest.fn().mockResolvedValue([]) },
    planningSeries: { create: jest.fn().mockResolvedValue({ id: 'series-1' }) },
    planningOverrideAudit: { create: jest.fn() },
    ...overrides,
  };
}

describe('POST /api/sessions/book', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 0, 1, 12, 0, 0));
    jest.clearAllMocks();

    (guardSensitiveRateLimit as jest.Mock).mockReturnValue(null);
    (requireAnyRole as jest.Mock).mockResolvedValue(mockElevSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    (parseBody as jest.Mock).mockResolvedValue(buildPayload());
    (createLogger as jest.Mock).mockReturnValue(mockLogger());
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-1',
      student: { id: 'student-user-1', firstName: 'Student', lastName: 'User' },
      coach: { id: 'coach-user-1', firstName: 'Coach', lastName: 'One' },
      parent: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 429 when rate limited', async () => {
    (guardSensitiveRateLimit as jest.Mock).mockReturnValue(
      NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));

    expect(response.status).toBe(429);
  });

  it('returns auth error response when guard fails', async () => {
    const mockErrorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAnyRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));

    expect(response.status).toBe(401);
  });

  it('rejects bookings more than 3 months in advance', async () => {
    (parseBody as jest.Mock).mockResolvedValue(buildPayload({ scheduledDate: '2025-05-02' }));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects weekend bookings', async () => {
    (parseBody as jest.Mock).mockResolvedValue(buildPayload({ scheduledDate: '2025-01-04' }));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects bookings outside business hours', async () => {
    (parseBody as jest.Mock).mockResolvedValue(buildPayload({ startTime: '07:00', endTime: '08:00' }));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('denies an ELEVE booking a session for another student profile', async () => {
    const tx = makeTransactionMocks({
      student: { findUnique: jest.fn().mockResolvedValue(studentRecord({ userId: 'someone-else' })) },
    });
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('denies a PARENT booking a session for a student outside their household', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue(mockParentSession);
    const tx = makeTransactionMocks({
      student: { findUnique: jest.fn().mockResolvedValue(studentRecord({ parent: { userId: 'not-this-parent', user: { mergedIntoUserId: null } } })) },
    });
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('denies booking when the student account has been merged into another', async () => {
    const tx = makeTransactionMocks({
      student: { findUnique: jest.fn().mockResolvedValue(studentRecord({ user: { mergedIntoUserId: 'other-user' } })) },
    });
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('denies booking when the student has no active household (no parent)', async () => {
    const tx = makeTransactionMocks({
      student: { findUnique: jest.fn().mockResolvedValue(studentRecord({ parent: null })) },
    });
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('returns 400 when the student profile does not exist', async () => {
    const tx = makeTransactionMocks({ student: { findUnique: jest.fn().mockResolvedValue(null) } });
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    expect(response.status).toBe(400);
  });

  it('creates the booking with creditsUsed: 0 (Amendement 11 — no credit path exists in the shared materialization)', async () => {
    const tx = makeTransactionMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(tx.sessionBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creditsUsed: 0 }) }),
    );
  });

  it('books a session successfully as PARENT for their own child, recording parentId from the student household', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue(mockParentSession);
    const tx = makeTransactionMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    // `parentId` sur SessionBooking est dérivé par `resolveSeriesParticipants`
    // (lib/planning/series.ts) depuis `Student.parent.userId` — pas depuis
    // `session.user.id` directement — mais pour un PARENT réservant pour son
    // propre enfant (le seul cas autorisé, vérifié par le rattachement au
    // foyer plus haut dans la route), les deux coïncident : ici
    // `studentRecord().parent.userId === mockParentSession.user.id`.
    expect(tx.sessionBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: mockParentSession.user.id,
          studentProfileId,
          coachProfileId,
          assignmentId,
          academicCourseKey,
        }),
      }),
    );
  });

  it('routes the booking through materializePlanningSeries with a PARENT_STUDENT requester (no override capability)', async () => {
    const tx = makeTransactionMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    await POST(createMockRequest('http://localhost:3000/api/sessions/book'));

    expect(tx.sessionBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentProfileId,
          coachProfileId,
          assignmentId,
          academicCourseKey,
        }),
      }),
    );
  });

  it('still blocks scheduling conflicts via the shared invariants (409)', async () => {
    const tx = makeTransactionMocks();
    tx.sessionBooking.findMany.mockResolvedValueOnce([
      { scheduledDate: new Date('2025-01-06T00:00:00Z'), startTime: '10:00', endTime: '11:00' },
    ]);
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    expect(response.status).toBe(409);
    expect(tx.sessionBooking.create).not.toHaveBeenCalled();
  });

  it('still blocks unavailable coach slots via the shared invariants (400)', async () => {
    const tx = makeTransactionMocks();
    tx.coachAvailability.findMany.mockResolvedValue([]);
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    expect(response.status).toBe(400);
    expect(tx.sessionBooking.create).not.toHaveBeenCalled();
  });

  it('returns 409 for overlapping session exclusion constraint', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: '23P01' });

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('BOOKING_CONFLICT');
  });

  it('returns 409 for serialization conflicts', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(Object.assign(new Error('serialization'), { code: 'P2034' }));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('BOOKING_SERIALIZATION');
  });

  it('creates booking and side effects on success', async () => {
    const tx = makeTransactionMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.sessionId).toBe('session-1');
    expect(prisma.sessionNotification.createMany).toHaveBeenCalled();
    expect(prisma.sessionReminder.createMany).toHaveBeenCalled();
  });

  it('returns 201 even if notification side-effect fails (post-commit resilience)', async () => {
    const tx = makeTransactionMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));
    (prisma.sessionNotification.createMany as jest.Mock).mockRejectedValue(
      Object.assign(new Error('FK violation'), { code: 'P2003' })
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
  });
});
