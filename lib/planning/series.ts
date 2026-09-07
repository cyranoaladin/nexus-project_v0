/**
 * Matérialisation d'une `PlanningSeries` gouvernée → `SessionBooking`.
 *
 * Tâche 11 (docs/superpowers/plans/2026-09-06-core-family-academic-planning.md) :
 * seul point d'entrée qui crée des séances de planning « premier tour »
 * (planification assistante/admin). Compose EXCLUSIVEMENT les invariants déjà
 * centralisés par la Tâche 10 (`lib/planning/invariants.ts`) — jamais de
 * contrôle de conflit/disponibilité/périmètre pédagogique réimplémenté ici.
 *
 * ── Occurrence unique vs récurrence ──────────────────────────────────────────
 * Une planification SANS récurrence est traitée comme une `PlanningSeries`
 * avec `recurrenceCount: 1` plutôt qu'un chemin de code séparé « réservation
 * nue » : un seul chemin de matérialisation, un seul endroit qui applique les
 * invariants, dual-write les identités et pose `occurrenceKey`. C'est
 * explicitement l'option suggérée par le plan d'implémentation (Tâche 11).
 *
 * ── Tout-ou-rien ─────────────────────────────────────────────────────────────
 * `materializePlanningSeries` s'exécute entièrement à l'intérieur de la
 * TRANSACTION sérialisable ouverte par l'appelant (jamais `prisma` global).
 * Dès qu'UNE occurrence échoue ses invariants, une exception est levée : la
 * transaction de l'appelant retombe (rollback), donc AUCUNE occurrence de la
 * série n'est committée — cohérent avec « reloads and verifies all invariants
 * inside a serializable transaction » (spec Operational planning).
 *
 * ── Idempotence — ce que ce module garantit RÉELLEMENT ──────────────────────
 * `occurrenceKey` est déterministe (`${seriesId}:${index}`) et porte une
 * contrainte unique en base. C'est une garde défensive au niveau DB contre une
 * double-insertion accidentelle DANS UN SEUL appel de matérialisation — CE
 * N'EST PAS un mécanisme d'idempotence applicative pour des requêtes rejouées
 * (revue de code, voir aussi __tests__/lib/planning/series.test.ts). En
 * pratique :
 *   - une CRÉATION rejouée génère un nouveau `PlanningSeries.id` à chaque
 *     appel (`materializePlanningSeries` crée toujours une ligne neuve) : il
 *     n'existe donc aucun scénario où deux appels de création calculeraient
 *     le même `occurrenceKey` ;
 *   - `rematerializeFutureOccurrences` dérive son `startIndex` d'un
 *     `sessionBooking.count` lu EN DIRECT au moment de l'appel, qui avance
 *     après chaque matérialisation réussie : un rejeu séquentiel recalculerait
 *     donc un `startIndex` différent, jamais le même `occurrenceKey` ;
 *   - et même dans un scénario concurrent artificiel où le MÊME
 *     `occurrenceKey` serait malgré tout recalculé, `resolveOccurrenceOutcome`
 *     réévalue les invariants (dont les conflits Élève/Coach, SANS
 *     auto-exclusion — aucun `excludeSessionBookingId` n'est propagé par ce
 *     module) juste AVANT l'insertion : il trouverait quasi certainement
 *     l'occurrence sœur déjà committée et rejetterait en
 *     `PlanningInvariantViolationError` avant même d'atteindre l'insert et son
 *     catch P2002 — rendant cette branche catch, en pratique, difficilement
 *     atteignable par ce chemin.
 * La garantie d'idempotence RÉELLE pour le flux d'édition (PUT) est le CAS de
 * révision optimiste sur `PlanningSeries.revision`, implémenté par
 * `app/api/assistante/planning/series/[seriesId]/route.ts` : une requête
 * rejouée avec un `expectedRevision` périmé est rejetée en 409
 * `PLANNING_SERIES_REVISION_CONFLICT` AVANT que `rematerializeFutureOccurrences`
 * ne soit jamais appelée — voir le docstring de `PUT` dans cette route.
 * Ceci ne couvre pas non plus le cas d'une requête HTTP de CRÉATION
 * entièrement rejouée (qui génère un nouveau `seriesId`) — un idempotency-key
 * applicatif de bout en bout (voir `lib/bilans/api/idempotency.ts`) resterait
 * nécessaire pour ce cas, hors périmètre de cette tâche (non listé dans ses
 * fichiers).
 */

import { Prisma, type SessionModality, type SessionType, type Subject } from '@prisma/client';
import { getCourse } from '@/lib/curriculum/catalog';
import {
  verifyPlanningInvariants,
  ACTIVE_BOOKING_STATUSES,
  type PlanningInvariantFailure,
  type PlanningInvariantRequester,
  type VerifyPlanningInvariantsInput,
} from './invariants';

export { ACTIVE_BOOKING_STATUSES };

// ── Constantes ───────────────────────────────────────────────────────────────

/** Même plafond que l'ancienne boucle inline de app/api/assistante/sessions/route.ts. */
export const MAX_SERIES_OCCURRENCES = 104;

// ── Erreurs typées ───────────────────────────────────────────────────────────

export class PlanningTooManyOccurrencesError extends Error {
  readonly code = 'PLANNING_TOO_MANY_OCCURRENCES' as const;
  constructor(readonly max: number) {
    super(`Trop d’occurrences demandées (max ${max})`);
    this.name = 'PlanningTooManyOccurrencesError';
  }
}

export class PlanningParticipantNotFoundError extends Error {
  readonly code = 'PLANNING_PARTICIPANT_NOT_FOUND' as const;
  constructor(readonly participant: 'STUDENT' | 'COACH') {
    super(participant === 'STUDENT' ? 'Élève introuvable' : 'Coach introuvable');
    this.name = 'PlanningParticipantNotFoundError';
  }
}

export class PlanningCourseWithoutLegacySubjectError extends Error {
  readonly code = 'PLANNING_COURSE_WITHOUT_LEGACY_SUBJECT' as const;
  constructor(readonly academicCourseKey: string) {
    super(
      `Le cours ${academicCourseKey} n'a pas de matière historique équivalente : impossible de planifier une séance tant que le champ SessionBooking.subject est requis`,
    );
    this.name = 'PlanningCourseWithoutLegacySubjectError';
  }
}

export class PlanningInvariantViolationError extends Error {
  readonly code = 'PLANNING_INVARIANT_VIOLATION' as const;
  constructor(
    readonly occurrenceDate: Date,
    readonly failures: readonly PlanningInvariantFailure[],
  ) {
    super(
      `Invariant de planning violé pour l'occurrence du ${occurrenceDate.toISOString().slice(0, 10)} : ${failures
        .map((f) => f.message)
        .join('; ')}`,
    );
    this.name = 'PlanningInvariantViolationError';
  }
}

/** `true` si au moins un échec appartient à une catégorie de CONFLIT (409), jamais dérogeable. */
export function invariantFailuresIncludeConflict(failures: readonly PlanningInvariantFailure[]): boolean {
  return failures.some(
    (f) => f.kind === 'STUDENT_CONFLICT' || f.kind === 'COACH_CONFLICT' || f.kind === 'STAGE_CONFLICT',
  );
}

/**
 * `true` si `error` est une violation de contrainte d'exclusion PostgreSQL
 * (`SessionBooking_no_overlap_excl` / `SessionBooking_student_profile_no_overlap_excl`,
 * migrations 20260201201415 et 20260906200000) OU un échec de sérialisation
 * (isolation SERIALIZABLE) — les deux catégories que les routes doivent
 * convertir en 409 stable plutôt qu'en 500.
 *
 * IMPORTANT (bug latent découvert par le test réel Postgres de cette Tâche —
 * `__tests__/integration/planning-concurrency.real.test.ts`) : Prisma ne
 * mappe PAS une contrainte d'exclusion PostgreSQL (SQLSTATE `23P01`) sur un
 * code connu — elle surgit comme `Prisma.PrismaClientUnknownRequestError`,
 * SANS propriété `.code` du tout (vérifié empiriquement contre un vrai
 * Postgres jetable). Le pattern préexistant ailleurs dans ce dépôt
 * (`(error as { code?: string })?.code === '23P01'`, ex. l'ancienne
 * app/api/assistante/sessions/route.ts) ne peut donc JAMAIS matcher en
 * pratique — seul le message d'erreur le porte. Un échec de sérialisation
 * (SQLSTATE `40001`), lui, EST mappé par Prisma sur le code connu `P2034`
 * (`PrismaClientKnownRequestError`). Cette fonction couvre les deux cas
 * réels, pas seulement celui qui « semblait » couvert.
 */
export function isPlanningConflictDatabaseError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  if (error instanceof Error && /23P01/.test(error.message)) return true;
  return false;
}

// ── Génération de dates — hebdomadaire, ancrée Africa/Tunis ──────────────────

/**
 * Analyse une date calendaire `"YYYY-MM-DD"` en `Date` UTC-minuit.
 *
 * Convention déjà établie par `lib/planning/identities.ts` et
 * `lib/planning/effective-availability.ts` : la date calendaire d'une
 * occurrence est portée par les accesseurs UTC d'un `Date` (`getUTCDate`,
 * `getUTCDay`...), jamais par l'heure locale du serveur. Tunisie (Africa/Tunis)
 * est à décalage FIXE (UTC+1, aucun changement d'heure d'été depuis 2009) :
 * aucune bibliothèque de fuseau horaire n'est nécessaire pour un calcul
 * purement calendaire (semaine entière), et aucune n'existe déjà dans ce
 * dépôt (vérifié : ni `date-fns-tz`, ni `luxon`). Ajouter une dépendance
 * uniquement pour ce calcul serait une sur-ingénierie — voir la note du plan
 * d'implémentation Tâche 11.
 */
export function parseCalendarDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((part) => Number(part));
  if (!y || !m || !d) throw new Error(`Date calendaire invalide : ${dateStr}`);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) throw new Error(`Date calendaire invalide : ${dateStr}`);
  return date;
}

function addUTCDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/**
 * Instant courant décalé de +1h (Africa/Tunis, décalage FIXE UTC+1, aucun
 * DST depuis 2009) — SANS troncature au jour, heures et minutes conservées.
 *
 * C'est le seul instant comparable directement à une valeur produite par
 * `combineDateAndTime` (lib/planning/invariants.ts) : celle-ci encode
 * l'heure murale Tunis directement comme des accesseurs UTC ("pseudo-UTC"),
 * donc son instant réel est toujours `valeur - 1h`. Comparer un `Date.now()`
 * réel à une valeur pseudo-UTC sans ce décalage introduit un biais d'1h
 * (fix dashboards nextSession, Tâche 13) — cette fonction est la contrepartie
 * « instant » de `tunisTodayUtcMidnight` (contrepartie « jour »), même
 * bascule +1h.
 */
export function tunisNowAsPretendUtc(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

/**
 * Jour calendaire courant Africa/Tunis, en minuit UTC — frontière « futur »
 * partagée par tout ce qui doit distinguer une occurrence passée d'une
 * occurrence future (annulation/édition future-only de
 * `app/api/assistante/planning/series/[seriesId]/route.ts`, Tâche 11, fix
 * 871998abd ; gates de lecture de la Tâche 12).
 *
 * Tunisie est à décalage FIXE UTC+1 (aucun DST depuis 2009) : décaler
 * l'horloge de +1h avant de lire les accesseurs UTC donne directement le jour
 * calendaire Tunis courant, sans bibliothèque de fuseau horaire.
 */
export function tunisTodayUtcMidnight(): Date {
  const tunisNow = tunisNowAsPretendUtc();
  return new Date(Date.UTC(tunisNow.getUTCFullYear(), tunisNow.getUTCMonth(), tunisNow.getUTCDate()));
}

export interface WeeklyRecurrenceSpec {
  readonly intervalWeeks: number;
  readonly count?: number;
  readonly until?: Date;
}

/**
 * Génère la liste des dates d'occurrence hebdomadaires, ancrées sur
 * `startDate`. Exactement `count` occurrences, OU toutes les occurrences
 * jusqu'à `until` inclus (plafonné à `MAX_SERIES_OCCURRENCES`) — jamais les
 * deux, jamais aucun (même contrat que `assistantWeeklyRecurrenceSchema`).
 */
export function generateWeeklyOccurrenceDates(
  startDate: Date,
  recurrence: WeeklyRecurrenceSpec,
): readonly Date[] {
  if (Boolean(recurrence.count) === Boolean(recurrence.until)) {
    throw new Error('Fournir count OU until, jamais les deux ni aucun');
  }

  const stepDays = 7 * recurrence.intervalWeeks;
  const dates: Date[] = [];

  if (recurrence.count) {
    if (recurrence.count > MAX_SERIES_OCCURRENCES) {
      throw new PlanningTooManyOccurrencesError(MAX_SERIES_OCCURRENCES);
    }
    for (let i = 0; i < recurrence.count; i++) {
      dates.push(addUTCDays(startDate, stepDays * i));
    }
    return dates;
  }

  let cursor = startDate;
  const until = recurrence.until!;
  while (cursor.getTime() <= until.getTime() && dates.length < MAX_SERIES_OCCURRENCES) {
    dates.push(cursor);
    cursor = addUTCDays(cursor, stepDays);
  }
  if (dates.length >= MAX_SERIES_OCCURRENCES && cursor.getTime() <= until.getTime()) {
    throw new PlanningTooManyOccurrencesError(MAX_SERIES_OCCURRENCES);
  }
  return dates;
}

/** Clé d'occurrence déterministe — voir la note d'idempotence en tête de fichier. */
export function buildOccurrenceKey(seriesId: string, index: number): string {
  return `${seriesId}:${index}`;
}

// ── Résolution participants / cours ──────────────────────────────────────────

interface ResolvedSeriesParticipants {
  readonly studentUserId: string;
  readonly coachUserId: string;
  readonly parentUserId: string | null;
  readonly legacySubject: Subject;
}

async function resolveSeriesParticipants(
  tx: Prisma.TransactionClient,
  params: { studentProfileId: string; coachProfileId: string; academicCourseKey: string },
): Promise<ResolvedSeriesParticipants> {
  const [studentRow, coachRow] = await Promise.all([
    tx.student.findUnique({
      where: { id: params.studentProfileId },
      select: { userId: true, parent: { select: { userId: true } } },
    }),
    tx.coachProfile.findUnique({
      where: { id: params.coachProfileId },
      select: { userId: true },
    }),
  ]);

  if (!studentRow) throw new PlanningParticipantNotFoundError('STUDENT');
  if (!coachRow) throw new PlanningParticipantNotFoundError('COACH');

  const course = getCourse(params.academicCourseKey);
  if (!course || !course.legacySubject) {
    throw new PlanningCourseWithoutLegacySubjectError(params.academicCourseKey);
  }

  return {
    studentUserId: studentRow.userId,
    coachUserId: coachRow.userId,
    parentUserId: studentRow.parent?.userId ?? null,
    legacySubject: course.legacySubject,
  };
}

// ── Détection d'usage effectif d'une dérogation ADMIN ────────────────────────

interface OccurrenceOutcome {
  readonly overrideUsed: boolean;
  readonly bypassedFailures: readonly PlanningInvariantFailure[];
}

/**
 * `verifyPlanningInvariants` applique déjà silencieusement la dérogation
 * ADMIN — `ok: true` peut donc signifier « aucun échec » OU « échec(s)
 * couverts par la dérogation ». Pour ne journaliser un
 * `PlanningOverrideAudit` QUE quand la dérogation a réellement servi, on
 * réévalue avec un requester SANS dérogation : si ce second résultat échoue
 * alors que le premier réussit, la dérogation a été consommée — et comme
 * `evaluatePlanningInvariants` ne filtre QUE les échecs d'identité dont le
 * code correspond exactement à la dérogation fournie, les échecs "bruts"
 * sont alors exactement ceux qui ont été bypassés (jamais un mélange avec un
 * autre échec non dérogeable, qui aurait aussi fait échouer le premier
 * résultat).
 */
async function resolveOccurrenceOutcome(
  tx: Prisma.TransactionClient,
  input: VerifyPlanningInvariantsInput,
  requester: PlanningInvariantRequester,
): Promise<OccurrenceOutcome> {
  const finalResult = await verifyPlanningInvariants(tx, input, requester);
  if (!finalResult.ok) {
    throw new PlanningInvariantViolationError(input.occurrenceDate, finalResult.failures);
  }

  if (requester.role !== 'ADMIN' || !requester.override) {
    return { overrideUsed: false, bypassedFailures: [] };
  }

  const rawRequester: PlanningInvariantRequester = { role: 'ADMIN', actorId: requester.actorId };
  const rawResult = await verifyPlanningInvariants(tx, input, rawRequester);
  if (rawResult.ok) {
    return { overrideUsed: false, bypassedFailures: [] };
  }
  return { overrideUsed: true, bypassedFailures: rawResult.failures };
}

// ── Matérialisation des occurrences (réutilisée par création ET édition) ────

export interface OccurrenceMaterializationContext {
  readonly seriesId: string;
  readonly studentProfileId: string;
  readonly coachProfileId: string;
  readonly studentUserId: string;
  readonly coachUserId: string;
  readonly parentUserId: string | null;
  readonly assignmentId: string;
  readonly academicCourseKey: string;
  readonly legacySubject: Subject;
  readonly modality: SessionModality;
  readonly location: string | null;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly durationMinutes: number;
  readonly title: string;
  readonly description: string | null;
  readonly type: SessionType;
  /** Décalage d'index pour la numérotation des `occurrenceKey` (rematérialisation : continue après les occurrences déjà créées). */
  readonly startIndex?: number;
}

export interface CreatedOccurrence {
  readonly id: string;
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly occurrenceKey: string;
}

function isUniqueConstraintViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function materializeOccurrencesForSeries(
  tx: Prisma.TransactionClient,
  ctx: OccurrenceMaterializationContext,
  dates: readonly Date[],
  requester: PlanningInvariantRequester,
): Promise<CreatedOccurrence[]> {
  const results: CreatedOccurrence[] = [];

  for (let i = 0; i < dates.length; i++) {
    const occurrenceDate = dates[i]!;
    const occurrenceKey = buildOccurrenceKey(ctx.seriesId, (ctx.startIndex ?? 0) + i);

    const invariantInput: VerifyPlanningInvariantsInput = {
      occurrenceDate,
      studentProfileId: ctx.studentProfileId,
      coachProfileId: ctx.coachProfileId,
      assignmentId: ctx.assignmentId,
      academicCourseKey: ctx.academicCourseKey,
      startTime: ctx.localStartTime,
      endTime: ctx.localEndTime,
    };

    const outcome = await resolveOccurrenceOutcome(tx, invariantInput, requester);

    let booking: CreatedOccurrence;
    try {
      const created = await tx.sessionBooking.create({
        data: {
          studentId: ctx.studentUserId,
          coachId: ctx.coachUserId,
          parentId: ctx.parentUserId,
          studentProfileId: ctx.studentProfileId,
          coachProfileId: ctx.coachProfileId,
          assignmentId: ctx.assignmentId,
          academicCourseKey: ctx.academicCourseKey,
          planningSeriesId: ctx.seriesId,
          occurrenceKey,
          subject: ctx.legacySubject,
          title: ctx.title,
          description: ctx.description ?? undefined,
          scheduledDate: occurrenceDate,
          startTime: ctx.localStartTime,
          endTime: ctx.localEndTime,
          duration: ctx.durationMinutes,
          type: ctx.type,
          modality: ctx.modality,
          location: ctx.location ?? undefined,
          // Invariant explicite et documenté : aucune séance créée par ce
          // module ne consomme jamais de crédit (voir Tâche 11 checklist).
          creditsUsed: 0,
          status: 'SCHEDULED',
        },
        select: { id: true, scheduledDate: true, startTime: true, endTime: true, occurrenceKey: true },
      });
      booking = { ...created, occurrenceKey: created.occurrenceKey! };
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        const existing = await tx.sessionBooking.findUnique({
          where: { occurrenceKey },
          select: { id: true, scheduledDate: true, startTime: true, endTime: true, occurrenceKey: true },
        });
        if (existing) {
          results.push({ ...existing, occurrenceKey: existing.occurrenceKey! });
          continue;
        }
      }
      throw error;
    }

    if (outcome.overrideUsed && requester.role === 'ADMIN' && requester.override) {
      await tx.planningOverrideAudit.create({
        data: {
          sessionBookingId: booking.id,
          planningSeriesId: ctx.seriesId,
          overrideCode: requester.override.code,
          overrideReason: requester.override.reason,
          actorId: requester.actorId,
          previousValues: {
            failures: outcome.bypassedFailures.map((f) => ({
              kind: f.kind,
              reason: 'reason' in f ? f.reason : undefined,
              message: f.message,
            })),
          },
          nextValues: {
            sessionBookingId: booking.id,
            occurrenceDate: occurrenceDate.toISOString(),
            studentProfileId: ctx.studentProfileId,
            coachProfileId: ctx.coachProfileId,
            academicCourseKey: ctx.academicCourseKey,
          },
        },
      });
    }

    results.push(booking);
  }

  return results;
}

// ── Création d'une série (chemin unique occurrence-unique + récurrente) ─────

export interface MaterializePlanningSeriesInput {
  readonly studentProfileId: string;
  readonly coachProfileId: string;
  readonly assignmentId: string;
  readonly academicCourseKey: string;
  readonly timezone?: string;
  /** Date calendaire (UTC-minuit) de la première occurrence. */
  readonly startDate: Date;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly durationMinutes: number;
  readonly intervalWeeks: number;
  readonly count?: number;
  readonly until?: Date;
  readonly modality: SessionModality;
  readonly location?: string | null;
  readonly type: SessionType;
  readonly title: string;
  readonly description?: string | null;
  readonly createdById: string;
}

export interface PlanningSeriesMaterializationResult {
  readonly seriesId: string;
  readonly occurrences: readonly CreatedOccurrence[];
}

function buildRecurrenceRule(intervalWeeks: number, count?: number, until?: Date): string {
  let rule = `FREQ=WEEKLY;INTERVAL=${intervalWeeks}`;
  if (count) rule += `;COUNT=${count}`;
  if (until) rule += `;UNTIL=${until.toISOString().slice(0, 10).replace(/-/g, '')}`;
  return rule;
}

/**
 * Point d'entrée UNIQUE de création d'une série gouvernée (occurrence unique
 * OU récurrente). S'exécute dans la transaction sérialisable ouverte par
 * l'appelant (route API) — tout-ou-rien, voir note en tête de fichier.
 */
export async function materializePlanningSeries(
  tx: Prisma.TransactionClient,
  input: MaterializePlanningSeriesInput,
  requester: PlanningInvariantRequester,
): Promise<PlanningSeriesMaterializationResult> {
  const dates = generateWeeklyOccurrenceDates(input.startDate, {
    intervalWeeks: input.intervalWeeks,
    count: input.count,
    until: input.until,
  });

  const participants = await resolveSeriesParticipants(tx, {
    studentProfileId: input.studentProfileId,
    coachProfileId: input.coachProfileId,
    academicCourseKey: input.academicCourseKey,
  });

  const series = await tx.planningSeries.create({
    data: {
      studentProfileId: input.studentProfileId,
      coachProfileId: input.coachProfileId,
      assignmentId: input.assignmentId,
      academicCourseKey: input.academicCourseKey,
      timezone: input.timezone ?? 'Africa/Tunis',
      startDate: input.startDate,
      localStartTime: input.localStartTime,
      localEndTime: input.localEndTime,
      recurrenceRule: buildRecurrenceRule(input.intervalWeeks, input.count, input.until),
      recurrenceCount: input.count ?? null,
      recurrenceUntil: input.until ?? null,
      modality: input.modality,
      location: input.location ?? null,
      createdById: input.createdById,
    },
    select: { id: true },
  });

  const occurrences = await materializeOccurrencesForSeries(
    tx,
    {
      seriesId: series.id,
      studentProfileId: input.studentProfileId,
      coachProfileId: input.coachProfileId,
      studentUserId: participants.studentUserId,
      coachUserId: participants.coachUserId,
      parentUserId: participants.parentUserId,
      assignmentId: input.assignmentId,
      academicCourseKey: input.academicCourseKey,
      legacySubject: participants.legacySubject,
      modality: input.modality,
      location: input.location ?? null,
      localStartTime: input.localStartTime,
      localEndTime: input.localEndTime,
      durationMinutes: input.durationMinutes,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
    },
    dates,
    requester,
  );

  return { seriesId: series.id, occurrences };
}

// ── Rematérialisation future-only (édition de série, route dédiée) ──────────

export interface RematerializeFutureOccurrencesInput {
  readonly seriesId: string;
  readonly studentProfileId: string;
  readonly coachProfileId: string;
  readonly assignmentId: string;
  readonly academicCourseKey: string;
  readonly modality: SessionModality;
  readonly location: string | null;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly durationMinutes: number;
  readonly title: string;
  readonly description: string | null;
  readonly type: SessionType;
  readonly startDate: Date;
  readonly intervalWeeks: number;
  readonly count?: number;
  readonly until?: Date;
}

/**
 * Rematérialise le planning futur d'une série EXISTANTE (édition future-only,
 * Tâche 11). L'appelant a déjà : (1) vérifié le CAS de révision, (2) annulé
 * les occurrences futures existantes. Continue la numérotation
 * `occurrenceKey` après les occurrences déjà matérialisées pour cette série
 * (jamais de collision avec les occurrences annulées, dont la ligne demeure).
 */
export async function rematerializeFutureOccurrences(
  tx: Prisma.TransactionClient,
  input: RematerializeFutureOccurrencesInput,
  requester: PlanningInvariantRequester,
): Promise<CreatedOccurrence[]> {
  const dates = generateWeeklyOccurrenceDates(input.startDate, {
    intervalWeeks: input.intervalWeeks,
    count: input.count,
    until: input.until,
  });

  const participants = await resolveSeriesParticipants(tx, {
    studentProfileId: input.studentProfileId,
    coachProfileId: input.coachProfileId,
    academicCourseKey: input.academicCourseKey,
  });

  const existingCount = await tx.sessionBooking.count({ where: { planningSeriesId: input.seriesId } });

  return materializeOccurrencesForSeries(
    tx,
    {
      seriesId: input.seriesId,
      studentProfileId: input.studentProfileId,
      coachProfileId: input.coachProfileId,
      studentUserId: participants.studentUserId,
      coachUserId: participants.coachUserId,
      parentUserId: participants.parentUserId,
      assignmentId: input.assignmentId,
      academicCourseKey: input.academicCourseKey,
      legacySubject: participants.legacySubject,
      modality: input.modality,
      location: input.location,
      localStartTime: input.localStartTime,
      localEndTime: input.localEndTime,
      durationMinutes: input.durationMinutes,
      title: input.title,
      description: input.description,
      type: input.type,
      startIndex: existingCount,
    },
    dates,
    requester,
  );
}

export { buildRecurrenceRule };
