/**
 * Invariants COMPLETS d'une occurrence de planning : prédicat de
 * chevauchement partagé (élève/coach/stage), composition avec identité et
 * disponibilité, dérogations ADMIN enumérées et non temporelles, chargement
 * via un client de transaction.
 */

import {
  ACTIVE_BOOKING_STATUSES,
  combineDateAndTime,
  evaluatePlanningInvariants,
  hasOverlappingRange,
  rangesOverlap,
  verifyPlanningInvariants,
  type PlanningInvariantData,
  type PlanningInvariantRequester,
} from '@/lib/planning/invariants';
import type { PlanningIdentitySnapshot } from '@/lib/planning/identities';

// ── Prédicat de chevauchement ────────────────────────────────────────────────

describe('rangesOverlap — toutes les formes de bord', () => {
  const existingStart = new Date('2026-03-10T10:00:00Z');
  const existingEnd = new Date('2026-03-10T11:00:00Z');

  it('le candidat commence pendant l\'existant', () => {
    expect(
      rangesOverlap(new Date('2026-03-10T10:30:00Z'), new Date('2026-03-10T11:30:00Z'), existingStart, existingEnd),
    ).toBe(true);
  });

  it('le candidat termine pendant l\'existant', () => {
    expect(
      rangesOverlap(new Date('2026-03-10T09:30:00Z'), new Date('2026-03-10T10:30:00Z'), existingStart, existingEnd),
    ).toBe(true);
  });

  it("le candidat est entièrement inclus dans l'existant", () => {
    expect(
      rangesOverlap(new Date('2026-03-10T10:15:00Z'), new Date('2026-03-10T10:45:00Z'), existingStart, existingEnd),
    ).toBe(true);
  });

  it("le candidat englobe entièrement l'existant", () => {
    expect(
      rangesOverlap(new Date('2026-03-10T09:00:00Z'), new Date('2026-03-10T12:00:00Z'), existingStart, existingEnd),
    ).toBe(true);
  });

  it('correspondance exacte', () => {
    expect(rangesOverlap(existingStart, existingEnd, existingStart, existingEnd)).toBe(true);
  });

  it('deux créneaux qui se touchent exactement ne se chevauchent pas', () => {
    expect(
      rangesOverlap(existingEnd, new Date('2026-03-10T12:00:00Z'), existingStart, existingEnd),
    ).toBe(false);
  });

  it('deux créneaux disjoints ne se chevauchent pas', () => {
    expect(
      rangesOverlap(new Date('2026-03-10T12:00:00Z'), new Date('2026-03-10T13:00:00Z'), existingStart, existingEnd),
    ).toBe(false);
  });
});

describe('hasOverlappingRange', () => {
  it("détecte un chevauchement au sein d'une liste de plages", () => {
    const candidate = { start: new Date('2026-03-10T10:00:00Z'), end: new Date('2026-03-10T11:00:00Z') };
    const existing = [
      { start: new Date('2026-03-10T08:00:00Z'), end: new Date('2026-03-10T09:00:00Z') },
      { start: new Date('2026-03-10T10:30:00Z'), end: new Date('2026-03-10T11:30:00Z') },
    ];
    expect(hasOverlappingRange(candidate, existing)).toBe(true);
  });

  it('aucun chevauchement quand la liste est vide ou disjointe', () => {
    const candidate = { start: new Date('2026-03-10T10:00:00Z'), end: new Date('2026-03-10T11:00:00Z') };
    expect(hasOverlappingRange(candidate, [])).toBe(false);
    expect(
      hasOverlappingRange(candidate, [{ start: new Date('2026-03-10T12:00:00Z'), end: new Date('2026-03-10T13:00:00Z') }]),
    ).toBe(false);
  });
});

describe('combineDateAndTime', () => {
  it('combine une date (heure ignorée) et une heure locale en un instant UTC', () => {
    const combined = combineDateAndTime(new Date('2026-03-10T23:59:00Z'), '09:30');
    expect(combined.toISOString()).toBe('2026-03-10T09:30:00.000Z');
  });
});

describe('ACTIVE_BOOKING_STATUSES', () => {
  it("correspond exactement à l'ensemble protégé par les contraintes d'exclusion PostgreSQL", () => {
    expect([...ACTIVE_BOOKING_STATUSES].sort()).toEqual(['CONFIRMED', 'IN_PROGRESS', 'SCHEDULED']);
  });
});

// ── Composition pure ─────────────────────────────────────────────────────────

const PREMIERE_EDS = { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', stmgPathway: null };

function okIdentitySnapshot(): PlanningIdentitySnapshot {
  return {
    occurrenceDate: new Date('2026-03-10T00:00:00Z'),
    studentProfileId: 'student-1',
    coachProfileId: 'coach-1',
    academicCourseKey: 'eds-maths-premiere',
    student: { id: 'student-1', identity: PREMIERE_EDS },
    studentEnrollments: [{ courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN' }],
    assignment: {
      id: 'assignment-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'ACTIVE',
      startsAt: new Date('2026-01-01T00:00:00Z'),
      endsAt: null,
      academicCourseKeys: ['eds-maths-premiere'],
    },
    coachSubjects: ['MATHEMATIQUES'],
  };
}

function okData(overrides: Partial<PlanningInvariantData> = {}): PlanningInvariantData {
  return {
    identitySnapshot: okIdentitySnapshot(),
    availability: { available: true, reason: 'RECURRING_AVAILABLE' },
    candidateRange: { start: new Date('2026-03-10T10:00:00Z'), end: new Date('2026-03-10T11:00:00Z') },
    studentConflicts: [],
    coachConflicts: [],
    stageConflicts: [],
    ...overrides,
  };
}

const ASSISTANTE: PlanningInvariantRequester = { role: 'ASSISTANTE', actorId: 'assistante-1' };
const ADMIN: PlanningInvariantRequester = { role: 'ADMIN', actorId: 'admin-1' };

describe('evaluatePlanningInvariants', () => {
  it('ok:true quand tout est cohérent', () => {
    expect(evaluatePlanningInvariants(okData(), ASSISTANTE)).toEqual({ ok: true });
  });

  it('propage les échecs d\'identité', () => {
    const result = evaluatePlanningInvariants(
      okData({ identitySnapshot: { ...okIdentitySnapshot(), student: null } }),
      ASSISTANTE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'IDENTITY', reason: 'STUDENT_NOT_FOUND' }));
    }
  });

  it('échoue AVAILABILITY quand le créneau ne correspond à aucune disponibilité', () => {
    const result = evaluatePlanningInvariants(
      okData({ availability: { available: false, reason: 'DATED_BLACKOUT' } }),
      ASSISTANTE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'AVAILABILITY', reason: 'DATED_BLACKOUT' }));
    }
  });

  it('échoue STUDENT_CONFLICT en cas de chevauchement élève', () => {
    const result = evaluatePlanningInvariants(
      okData({ studentConflicts: [{ start: new Date('2026-03-10T10:30:00Z'), end: new Date('2026-03-10T11:30:00Z') }] }),
      ASSISTANTE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'STUDENT_CONFLICT' }));
  });

  it('échoue COACH_CONFLICT en cas de chevauchement coach', () => {
    const result = evaluatePlanningInvariants(
      okData({ coachConflicts: [{ start: new Date('2026-03-10T09:30:00Z'), end: new Date('2026-03-10T10:30:00Z') }] }),
      ASSISTANTE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'COACH_CONFLICT' }));
  });

  it('échoue STAGE_CONFLICT en cas de chevauchement stage', () => {
    const result = evaluatePlanningInvariants(
      okData({ stageConflicts: [{ start: new Date('2026-03-10T10:00:00Z'), end: new Date('2026-03-10T11:00:00Z') }] }),
      ASSISTANTE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'STAGE_CONFLICT' }));
  });

  it('cumule les échecs indépendants au lieu de s\'arrêter au premier', () => {
    const result = evaluatePlanningInvariants(
      okData({
        availability: { available: false, reason: 'NO_MATCHING_AVAILABILITY' },
        stageConflicts: [{ start: new Date('2026-03-10T10:00:00Z'), end: new Date('2026-03-10T11:00:00Z') }],
      }),
      ASSISTANTE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const kinds = result.failures.map((f) => f.kind);
      expect(kinds).toEqual(expect.arrayContaining(['AVAILABILITY', 'STAGE_CONFLICT']));
    }
  });
});

describe('evaluatePlanningInvariants — dérogations ADMIN', () => {
  it('ADMIN avec le code correspondant lève un échec COACH_CAPABILITY_MISSING', () => {
    const data = okData({
      identitySnapshot: { ...okIdentitySnapshot(), coachSubjects: ['NSI'] },
    });
    const result = evaluatePlanningInvariants(data, {
      ...ADMIN,
      override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'Capacité réelle confirmée par le staff' },
    });
    expect(result).toEqual({ ok: true });
  });

  it('ASSISTANTE ne peut jamais lever un échec, même identique à ADMIN', () => {
    const data = okData({
      identitySnapshot: { ...okIdentitySnapshot(), coachSubjects: ['NSI'] },
    });
    const result = evaluatePlanningInvariants(data, ASSISTANTE);
    expect(result.ok).toBe(false);
  });

  it('une dérogation ADMIN ne lève jamais un conflit élève/coach/stage', () => {
    const data = okData({
      studentConflicts: [{ start: new Date('2026-03-10T10:00:00Z'), end: new Date('2026-03-10T11:00:00Z') }],
    });
    const result = evaluatePlanningInvariants(data, {
      ...ADMIN,
      override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'peu importe' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'STUDENT_CONFLICT' }));
  });

  it('une dérogation ADMIN ne lève jamais un échec de disponibilité (temporel)', () => {
    const data = okData({ availability: { available: false, reason: 'DATED_BLACKOUT' } });
    const result = evaluatePlanningInvariants(data, {
      ...ADMIN,
      override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'peu importe' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'AVAILABILITY' }));
  });

  it('une ASSISTANTE construite dynamiquement avec un champ override est rejetée à l\'exécution', () => {
    const rogue = { role: 'ASSISTANTE', actorId: 'x', override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'x' } };
    expect(() => evaluatePlanningInvariants(okData(), rogue as unknown as PlanningInvariantRequester)).toThrow();
  });
});

// ── Chargement via un client de transaction ─────────────────────────────────

function buildFakeTx(overrides: Record<string, unknown> = {}) {
  const defaults = {
    student: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'student-1',
        gradeLevel: 'PREMIERE',
        academicTrack: 'EDS_GENERALE',
        stmgPathway: null,
      }),
    },
    coachStudentAssignment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'assignment-1',
        studentId: 'student-1',
        coachId: 'coach-1',
        status: 'ACTIVE',
        startsAt: new Date('2026-01-01T00:00:00Z'),
        endsAt: null,
        academicCourseKeys: ['eds-maths-premiere'],
      }),
    },
    coachProfile: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'coach-user-1', subjects: ['MATHEMATIQUES'] }),
    },
    studentAcademicEnrollment: {
      findMany: jest.fn().mockResolvedValue([{ courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN' }]),
    },
    coachAvailability: {
      findMany: jest.fn().mockResolvedValue([
        {
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '17:00',
          specificDate: null,
          isAvailable: true,
          isRecurring: true,
          validFrom: new Date('2026-01-01T00:00:00Z'),
          validUntil: null,
        },
      ]),
    },
    sessionBooking: { findMany: jest.fn().mockResolvedValue([]) },
    stageReservation: { findMany: jest.fn().mockResolvedValue([]) },
    stageSession: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { ...defaults, ...overrides } as any;
}

const TUESDAY_INPUT = {
  occurrenceDate: new Date('2026-03-10T00:00:00Z'),
  startTime: '10:00',
  endTime: '11:00',
  studentProfileId: 'student-1',
  coachProfileId: 'coach-1',
  assignmentId: 'assignment-1',
  academicCourseKey: 'eds-maths-premiere',
};

describe('verifyPlanningInvariants — via un client de transaction', () => {
  it('ok:true en chargeant tout depuis le tx quand rien ne fait obstacle', async () => {
    const tx = buildFakeTx();
    const result = await verifyPlanningInvariants(tx, TUESDAY_INPUT, ASSISTANTE);
    expect(result).toEqual({ ok: true });
  });

  it('remonte un conflit élève chargé depuis sessionBooking', async () => {
    const tx = buildFakeTx({
      sessionBooking: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.studentProfileId === 'student-1'
              ? [{ scheduledDate: new Date('2026-03-10T00:00:00Z'), startTime: '10:30', endTime: '11:30' }]
              : [],
          ),
        ),
      },
    });
    const result = await verifyPlanningInvariants(tx, TUESDAY_INPUT, ASSISTANTE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'STUDENT_CONFLICT' }));
  });

  it('remonte un conflit de stage élève dérivé de sa réservation (jointure Stage → StageSession)', async () => {
    const tx = buildFakeTx({
      stageReservation: {
        findMany: jest.fn().mockResolvedValue([{ stageId: 'stage-1' }]),
      },
      stageSession: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.stageId?.in?.includes('stage-1')
              ? [{ startAt: new Date('2026-03-10T10:00:00Z'), endAt: new Date('2026-03-10T12:00:00Z') }]
              : [],
          ),
        ),
      },
    });
    const result = await verifyPlanningInvariants(tx, TUESDAY_INPUT, ASSISTANTE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'STAGE_CONFLICT' }));
  });

  it('remonte un échec d\'identité (assignation introuvable) chargé depuis le tx', async () => {
    const tx = buildFakeTx({ coachStudentAssignment: { findUnique: jest.fn().mockResolvedValue(null) } });
    const result = await verifyPlanningInvariants(tx, TUESDAY_INPUT, ASSISTANTE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures).toContainEqual(expect.objectContaining({ kind: 'IDENTITY', reason: 'ASSIGNMENT_NOT_FOUND' }));
    }
  });

  it('rejette une dérogation ADMIN fournie par un appelant ASSISTANTE, même via le chemin transactionnel', async () => {
    const tx = buildFakeTx();
    const rogue = {
      role: 'ASSISTANTE',
      actorId: 'x',
      override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'x' },
    };
    await expect(
      verifyPlanningInvariants(tx, TUESDAY_INPUT, rogue as unknown as PlanningInvariantRequester),
    ).rejects.toThrow();
  });
});
