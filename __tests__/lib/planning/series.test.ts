/**
 * Tâche 11 — matérialisation d'une `PlanningSeries` gouvernée.
 *
 * Reprend le fixture réel déjà validé par `__tests__/lib/planning/identities.test.ts`
 * (cours `eds-maths-premiere`, PREMIERE/EDS_GENERALE, coach `MATHEMATIQUES`)
 * pour exercer `materializePlanningSeries`/`materializeOccurrencesForSeries`
 * à travers TOUTE la pile d'invariants de la Tâche 10, avec un client de
 * transaction entièrement simulé.
 */

import { Prisma } from '@prisma/client';
import {
  MAX_SERIES_OCCURRENCES,
  PlanningCourseWithoutLegacySubjectError,
  PlanningInvariantViolationError,
  PlanningParticipantNotFoundError,
  PlanningTooManyOccurrencesError,
  buildOccurrenceKey,
  buildRecurrenceRule,
  generateWeeklyOccurrenceDates,
  invariantFailuresIncludeConflict,
  materializeOccurrencesForSeries,
  materializePlanningSeries,
  parseCalendarDate,
  rematerializeFutureOccurrences,
  type MaterializePlanningSeriesInput,
  type OccurrenceMaterializationContext,
} from '@/lib/planning/series';
import type { PlanningInvariantRequester } from '@/lib/planning/invariants';

// ── Génération de dates — pure ───────────────────────────────────────────────

describe('parseCalendarDate', () => {
  it('analyse une date calendaire en Date UTC-minuit', () => {
    const date = parseCalendarDate('2026-03-09');
    expect(date.toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });

  it('rejette une date invalide', () => {
    expect(() => parseCalendarDate('not-a-date')).toThrow();
  });
});

describe('generateWeeklyOccurrenceDates', () => {
  const startDate = parseCalendarDate('2026-03-09'); // lundi

  it('génère exactement `count` occurrences hebdomadaires', () => {
    const dates = generateWeeklyOccurrenceDates(startDate, { intervalWeeks: 1, count: 3 });
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
    ]);
  });

  it('respecte un intervalle de plusieurs semaines', () => {
    const dates = generateWeeklyOccurrenceDates(startDate, { intervalWeeks: 2, count: 3 });
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-03-09',
      '2026-03-23',
      '2026-04-06',
    ]);
  });

  it('génère jusqu’à `until` inclus', () => {
    const until = parseCalendarDate('2026-03-23');
    const dates = generateWeeklyOccurrenceDates(startDate, { intervalWeeks: 1, until });
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
    ]);
  });

  it('franchit correctement un changement de mois (pas de piège DST — Africa/Tunis est à décalage fixe)', () => {
    const dates = generateWeeklyOccurrenceDates(parseCalendarDate('2026-01-26'), {
      intervalWeeks: 1,
      count: 2,
    });
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-01-26', '2026-02-02']);
  });

  it('rejette count ET until fournis ensemble', () => {
    expect(() =>
      generateWeeklyOccurrenceDates(startDate, {
        intervalWeeks: 1,
        count: 3,
        until: parseCalendarDate('2026-04-01'),
      }),
    ).toThrow();
  });

  it('rejette ni count ni until', () => {
    expect(() => generateWeeklyOccurrenceDates(startDate, { intervalWeeks: 1 })).toThrow();
  });

  it(`rejette un count dépassant ${MAX_SERIES_OCCURRENCES}`, () => {
    expect(() =>
      generateWeeklyOccurrenceDates(startDate, { intervalWeeks: 1, count: MAX_SERIES_OCCURRENCES + 1 }),
    ).toThrow(PlanningTooManyOccurrencesError);
  });

  it(`rejette un "until" qui produirait plus de ${MAX_SERIES_OCCURRENCES} occurrences`, () => {
    const farUntil = parseCalendarDate('2030-01-01');
    expect(() => generateWeeklyOccurrenceDates(startDate, { intervalWeeks: 1, until: farUntil })).toThrow(
      PlanningTooManyOccurrencesError,
    );
  });
});

describe('buildOccurrenceKey', () => {
  it('est déterministe à partir de seriesId + index', () => {
    expect(buildOccurrenceKey('series-1', 0)).toBe('series-1:0');
    expect(buildOccurrenceKey('series-1', 4)).toBe('series-1:4');
  });
});

describe('buildRecurrenceRule', () => {
  it('formate FREQ=WEEKLY;INTERVAL=n;COUNT=n', () => {
    expect(buildRecurrenceRule(2, 5)).toBe('FREQ=WEEKLY;INTERVAL=2;COUNT=5');
  });
  it('formate FREQ=WEEKLY;INTERVAL=n;UNTIL=YYYYMMDD', () => {
    expect(buildRecurrenceRule(1, undefined, parseCalendarDate('2026-05-01'))).toBe(
      'FREQ=WEEKLY;INTERVAL=1;UNTIL=20260501',
    );
  });
});

describe('invariantFailuresIncludeConflict', () => {
  it('détecte une catégorie de conflit parmi les échecs', () => {
    expect(invariantFailuresIncludeConflict([{ kind: 'COACH_CONFLICT', message: 'x' }])).toBe(true);
    expect(invariantFailuresIncludeConflict([{ kind: 'AVAILABILITY', reason: 'NO_MATCHING_AVAILABILITY', message: 'x' }])).toBe(
      false,
    );
  });
});

// ── Matérialisation — tx entièrement simulé ──────────────────────────────────

const STUDENT_PROFILE_ID = 'student-profile-1';
const STUDENT_USER_ID = 'student-user-1';
const PARENT_USER_ID = 'parent-user-1';
const COACH_PROFILE_ID = 'coach-profile-1';
const COACH_USER_ID = 'coach-user-1';
const ASSIGNMENT_ID = 'assignment-1';
const COURSE_KEY = 'eds-maths-premiere'; // legacySubject MATHEMATIQUES — voir identities.test.ts
const ADMIN_ACTOR_ID = 'admin-1';
const ASSISTANTE_ACTOR_ID = 'assistante-1';

const ASSISTANTE_REQUESTER: PlanningInvariantRequester = { role: 'ASSISTANTE', actorId: ASSISTANTE_ACTOR_ID };

function buildFakeTx(overrides: { coachSubjects?: string[] } = {}) {
  const createdBookingsByKey = new Map<string, any>();

  const tx: any = {
    student: {
      findUnique: jest.fn().mockResolvedValue({
        id: STUDENT_PROFILE_ID,
        userId: STUDENT_USER_ID,
        gradeLevel: 'PREMIERE',
        academicTrack: 'EDS_GENERALE',
        stmgPathway: null,
        parent: { userId: PARENT_USER_ID },
      }),
    },
    coachProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: COACH_PROFILE_ID,
        userId: COACH_USER_ID,
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
      findMany: jest.fn().mockResolvedValue([
        {
          dayOfWeek: 1, // lundi — startDate '2026-03-09' est un lundi
          startTime: '08:00',
          endTime: '18:00',
          specificDate: null,
          isAvailable: true,
          isRecurring: true,
          validFrom: new Date('2026-01-01T00:00:00Z'),
          validUntil: null,
        },
      ]),
    },
    sessionBooking: {
      // Reflète RÉELLEMENT les lignes déjà "créées" dans ce tx simulé, filtrées
      // par studentProfileId/coachProfileId + scheduledDate exacte comme le
      // fait `loadConflictingBookingRanges` (lib/planning/invariants.ts) — et
      // honore une éventuelle auto-exclusion (`where.id.not`). Ceci est
      // nécessaire pour que le test de rejeu ci-dessous démontre un
      // comportement RÉEL plutôt qu'un mock découplé de son propre état (voir
      // la revue qui a motivé cette correction).
      findMany: jest.fn(async ({ where }: any) => {
        const rows: any[] = [];
        for (const row of createdBookingsByKey.values()) {
          if (where.id?.not && row.id === where.id.not) continue;
          if (where.studentProfileId && row.data?.studentProfileId !== where.studentProfileId) continue;
          if (where.coachProfileId && row.data?.coachProfileId !== where.coachProfileId) continue;
          if (where.scheduledDate && row.scheduledDate.getTime() !== where.scheduledDate.getTime()) continue;
          rows.push({ scheduledDate: row.scheduledDate, startTime: row.startTime, endTime: row.endTime });
        }
        return rows;
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async ({ data }: any) => {
        if (createdBookingsByKey.has(data.occurrenceKey)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on occurrenceKey', {
            code: 'P2002',
            clientVersion: '5.x',
          });
        }
        const row = {
          id: `booking-${data.occurrenceKey}`,
          scheduledDate: data.scheduledDate,
          startTime: data.startTime,
          endTime: data.endTime,
          occurrenceKey: data.occurrenceKey,
          data,
        };
        createdBookingsByKey.set(data.occurrenceKey, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => createdBookingsByKey.get(where.occurrenceKey) ?? null),
    },
    stageReservation: { findMany: jest.fn().mockResolvedValue([]) },
    stageSession: { findMany: jest.fn().mockResolvedValue([]) },
    planningSeries: {
      create: jest.fn().mockResolvedValue({ id: 'series-1' }),
    },
    planningOverrideAudit: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };

  return { tx, createdBookingsByKey };
}

function baseSeriesInput(overrides: Partial<MaterializePlanningSeriesInput> = {}): MaterializePlanningSeriesInput {
  return {
    studentProfileId: STUDENT_PROFILE_ID,
    coachProfileId: COACH_PROFILE_ID,
    assignmentId: ASSIGNMENT_ID,
    academicCourseKey: COURSE_KEY,
    startDate: parseCalendarDate('2026-03-09'),
    localStartTime: '09:00',
    localEndTime: '10:00',
    durationMinutes: 60,
    intervalWeeks: 1,
    count: 1,
    modality: 'ONLINE',
    type: 'INDIVIDUAL',
    title: 'Séance de mathématiques',
    createdById: ASSISTANTE_ACTOR_ID,
    ...overrides,
  };
}

describe('materializePlanningSeries — chemin heureux', () => {
  it('crée une série + une occurrence unique (recurrenceCount: 1), avec dual-write complet', async () => {
    const { tx } = buildFakeTx();
    const result = await materializePlanningSeries(tx, baseSeriesInput(), ASSISTANTE_REQUESTER);

    expect(result.seriesId).toBe('series-1');
    expect(result.occurrences).toHaveLength(1);
    expect(result.occurrences[0]!.occurrenceKey).toBe('series-1:0');

    expect(tx.planningSeries.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentProfileId: STUDENT_PROFILE_ID,
          coachProfileId: COACH_PROFILE_ID,
          assignmentId: ASSIGNMENT_ID,
          academicCourseKey: COURSE_KEY,
          timezone: 'Africa/Tunis',
          recurrenceCount: 1,
          recurrenceUntil: null,
        }),
      }),
    );

    expect(tx.sessionBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: STUDENT_USER_ID,
          coachId: COACH_USER_ID,
          parentId: PARENT_USER_ID,
          studentProfileId: STUDENT_PROFILE_ID,
          coachProfileId: COACH_PROFILE_ID,
          assignmentId: ASSIGNMENT_ID,
          academicCourseKey: COURSE_KEY,
          planningSeriesId: 'series-1',
          occurrenceKey: 'series-1:0',
          subject: 'MATHEMATIQUES',
          creditsUsed: 0,
          status: 'SCHEDULED',
        }),
      }),
    );
  });

  it('matérialise une série hebdomadaire récurrente : une occurrence par date, occurrenceKey séquentiel', async () => {
    const { tx } = buildFakeTx();
    const result = await materializePlanningSeries(
      tx,
      baseSeriesInput({ count: 3, intervalWeeks: 1 }),
      ASSISTANTE_REQUESTER,
    );

    expect(result.occurrences).toHaveLength(3);
    expect(result.occurrences.map((o) => o.occurrenceKey)).toEqual(['series-1:0', 'series-1:1', 'series-1:2']);
    expect(tx.sessionBooking.create).toHaveBeenCalledTimes(3);
  });

  it('accepte une récurrence bornée par "until"', async () => {
    const { tx } = buildFakeTx();
    const until = parseCalendarDate('2026-03-23');
    const result = await materializePlanningSeries(
      tx,
      baseSeriesInput({ count: undefined, until }),
      ASSISTANTE_REQUESTER,
    );
    expect(result.occurrences).toHaveLength(3);
  });
});

describe('materializePlanningSeries — tout-ou-rien', () => {
  it('un conflit sur UNE occurrence rejette toute la série (aucune occurrence suivante créée)', async () => {
    const { tx } = buildFakeTx();
    // Conflit coach sur la 2e occurrence (2026-03-16 09:00-10:00).
    tx.sessionBooking.findMany.mockImplementation(async ({ where }: any) => {
      if (where.coachProfileId && where.scheduledDate?.toISOString?.() === '2026-03-16T00:00:00.000Z') {
        return [{ scheduledDate: where.scheduledDate, startTime: '09:00', endTime: '10:00' }];
      }
      return [];
    });

    await expect(
      materializePlanningSeries(tx, baseSeriesInput({ count: 3 }), ASSISTANTE_REQUESTER),
    ).rejects.toBeInstanceOf(PlanningInvariantViolationError);

    // La 1ère occurrence a été créée avant l'échec, mais la 3e jamais tentée :
    // dans une vraie transaction, l'exception fait tout retomber (rollback) —
    // ce test unitaire vérifie l'arrêt immédiat de la boucle, la garantie
    // transactionnelle elle-même est prouvée par le test réel Postgres.
    expect(tx.sessionBooking.create).toHaveBeenCalledTimes(1);
  });

  it('ASSISTANTE ne peut jamais dériger : une capacité coach manquante échoue toujours', async () => {
    const { tx } = buildFakeTx({ coachSubjects: ['NSI'] }); // coach ne déclare pas MATHEMATIQUES
    await expect(
      materializePlanningSeries(tx, baseSeriesInput(), ASSISTANTE_REQUESTER),
    ).rejects.toBeInstanceOf(PlanningInvariantViolationError);
    expect(tx.planningOverrideAudit.create).not.toHaveBeenCalled();
  });
});

describe('materializePlanningSeries — dérogation ADMIN', () => {
  it('ADMIN avec le code COACH_CAPABILITY_NOT_DECLARED laisse passer et journalise un PlanningOverrideAudit', async () => {
    const { tx } = buildFakeTx({ coachSubjects: ['NSI'] });
    const adminRequester: PlanningInvariantRequester = {
      role: 'ADMIN',
      actorId: ADMIN_ACTOR_ID,
      override: { code: 'COACH_CAPABILITY_NOT_DECLARED', reason: 'Capacité réelle confirmée hors profil' },
    };

    const result = await materializePlanningSeries(tx, baseSeriesInput(), adminRequester);
    expect(result.occurrences).toHaveLength(1);

    expect(tx.planningOverrideAudit.create).toHaveBeenCalledTimes(1);
    const auditData = (tx.planningOverrideAudit.create as jest.Mock).mock.calls[0][0].data;
    expect(auditData.overrideCode).toBe('COACH_CAPABILITY_NOT_DECLARED');
    expect(auditData.overrideReason).toBe('Capacité réelle confirmée hors profil');
    expect(auditData.actorId).toBe(ADMIN_ACTOR_ID);
    expect(auditData.planningSeriesId).toBe('series-1');
    expect(auditData.previousValues.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'COACH_CAPABILITY_MISSING' })]),
    );
  });

  it('ADMIN sans dérogation nécessaire ne journalise rien (chemin heureux)', async () => {
    const { tx } = buildFakeTx();
    const adminRequester: PlanningInvariantRequester = { role: 'ADMIN', actorId: ADMIN_ACTOR_ID };
    await materializePlanningSeries(tx, baseSeriesInput(), adminRequester);
    expect(tx.planningOverrideAudit.create).not.toHaveBeenCalled();
  });
});

describe('materializeOccurrencesForSeries — idempotence de la rematérialisation', () => {
  function occurrenceContext(overrides: Partial<OccurrenceMaterializationContext> = {}): OccurrenceMaterializationContext {
    return {
      seriesId: 'series-1',
      studentProfileId: STUDENT_PROFILE_ID,
      coachProfileId: COACH_PROFILE_ID,
      studentUserId: STUDENT_USER_ID,
      coachUserId: COACH_USER_ID,
      parentUserId: PARENT_USER_ID,
      assignmentId: ASSIGNMENT_ID,
      academicCourseKey: COURSE_KEY,
      legacySubject: 'MATHEMATIQUES' as any,
      modality: 'ONLINE' as any,
      location: null,
      localStartTime: '09:00',
      localEndTime: '10:00',
      durationMinutes: 60,
      title: 'Séance de mathématiques',
      description: null,
      type: 'INDIVIDUAL' as any,
      ...overrides,
    };
  }

  it(
    'rejouer la matérialisation pour la MÊME série est rejeté par la vérification de conflit ' +
      "AVANT même d'atteindre la contrainte unique occurrenceKey — la protection réelle contre un " +
      'rejeu vient de là, pas du catch P2002 (voir la note d’idempotence en tête de fichier)',
    async () => {
      const { tx } = buildFakeTx();
      const dates = generateWeeklyOccurrenceDates(parseCalendarDate('2026-03-09'), {
        intervalWeeks: 1,
        count: 2,
      });

      const first = await materializeOccurrencesForSeries(tx, occurrenceContext(), dates, ASSISTANTE_REQUESTER);
      expect(first).toHaveLength(2);
      expect(tx.sessionBooking.create).toHaveBeenCalledTimes(2);

      // Rejeu : mêmes dates, même seriesId, même startIndex — un « vrai »
      // rejeu ne recalculerait de toute façon jamais les mêmes occurrenceKey
      // (voir la note d'idempotence), mais MÊME dans ce scénario artificiel où
      // il le ferait, le rejeu n'atteint JAMAIS le catch P2002 :
      // `resolveOccurrenceOutcome` réinterroge les conflits Élève/Coach SANS
      // auto-exclusion (aucun `excludeSessionBookingId` propagé ici) et trouve
      // la ligne sœur déjà committée par le premier appel — donc rejette en
      // PlanningInvariantViolationError avant l'insertion. `tx.sessionBooking
      // .findMany` ci-dessus reflète RÉELLEMENT l'état matérialisé (voir
      // `buildFakeTx`), contrairement à l'ancienne version de ce test qui le
      // renvoyait vide sans rapport avec les lignes créées.
      await expect(
        materializeOccurrencesForSeries(tx, occurrenceContext(), dates, ASSISTANTE_REQUESTER),
      ).rejects.toBeInstanceOf(PlanningInvariantViolationError);

      // Aucune ligne supplémentaire créée par la tentative de rejeu.
      expect(tx.sessionBooking.create).toHaveBeenCalledTimes(2);
    },
  );

  it(
    'la branche catch P2002 elle-même (isolée, indépendamment de la détection de conflit) ' +
      'retourne la ligne existante au lieu d’échouer si une violation de contrainte unique brute ' +
      'survient un jour sur occurrenceKey',
    async () => {
      const { tx, createdBookingsByKey } = buildFakeTx();
      const ctx = occurrenceContext();
      const dates = [parseCalendarDate('2026-03-09')];
      const occurrenceKey = buildOccurrenceKey(ctx.seriesId, 0);

      // Scénario délibérément artificiel : une ligne "déjà matérialisée" est
      // injectée directement (sans passer par `create`), et la vérification de
      // conflit est neutralisée (`findMany` -> []) pour isoler UNIQUEMENT le
      // comportement du catch — ce test ne prétend PAS que ce chemin est
      // atteignable en pratique (voir le test précédent et la note
      // d'idempotence en tête de fichier).
      const existingRow = {
        id: 'booking-existing',
        scheduledDate: dates[0],
        startTime: ctx.localStartTime,
        endTime: ctx.localEndTime,
        occurrenceKey,
      };
      createdBookingsByKey.set(occurrenceKey, existingRow);
      tx.sessionBooking.findMany.mockResolvedValue([]);
      tx.sessionBooking.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed on occurrenceKey', {
          code: 'P2002',
          clientVersion: '5.x',
        }),
      );

      const result = await materializeOccurrencesForSeries(tx, ctx, dates, ASSISTANTE_REQUESTER);
      expect(result).toEqual([existingRow]);
    },
  );
});

describe('rematerializeFutureOccurrences', () => {
  it('numérote les nouvelles occurrences après celles déjà matérialisées pour la série', async () => {
    const { tx } = buildFakeTx();
    tx.sessionBooking.count.mockResolvedValue(2); // 2 occurrences déjà matérialisées (index 0 et 1)

    const occurrences = await rematerializeFutureOccurrences(
      tx,
      {
        seriesId: 'series-1',
        studentProfileId: STUDENT_PROFILE_ID,
        coachProfileId: COACH_PROFILE_ID,
        assignmentId: ASSIGNMENT_ID,
        academicCourseKey: COURSE_KEY,
        modality: 'ONLINE' as any,
        location: null,
        localStartTime: '09:00',
        localEndTime: '10:00',
        durationMinutes: 60,
        title: 'Séance de mathématiques (révisée)',
        description: null,
        type: 'INDIVIDUAL' as any,
        startDate: parseCalendarDate('2026-03-23'),
        intervalWeeks: 1,
        count: 2,
      },
      ASSISTANTE_REQUESTER,
    );

    expect(occurrences.map((o) => o.occurrenceKey)).toEqual(['series-1:2', 'series-1:3']);
  });
});

describe('matérialisation — erreurs typées', () => {
  it('PlanningParticipantNotFoundError quand le Student est introuvable', async () => {
    const { tx } = buildFakeTx();
    tx.student.findUnique.mockResolvedValue(null);
    await expect(materializePlanningSeries(tx, baseSeriesInput(), ASSISTANTE_REQUESTER)).rejects.toBeInstanceOf(
      PlanningParticipantNotFoundError,
    );
  });

  it('PlanningParticipantNotFoundError quand le CoachProfile est introuvable', async () => {
    const { tx } = buildFakeTx();
    tx.coachProfile.findUnique.mockResolvedValue(null);
    await expect(materializePlanningSeries(tx, baseSeriesInput(), ASSISTANTE_REQUESTER)).rejects.toBeInstanceOf(
      PlanningParticipantNotFoundError,
    );
  });

  it('PlanningCourseWithoutLegacySubjectError quand academicCourseKey est inconnu du catalogue', async () => {
    const { tx } = buildFakeTx();
    await expect(
      materializePlanningSeries(tx, baseSeriesInput({ academicCourseKey: 'course-inexistant' }), ASSISTANTE_REQUESTER),
    ).rejects.toBeInstanceOf(PlanningCourseWithoutLegacySubjectError);
  });
});
