/**
 * Invariants COMPLETS d'une occurrence de planning — point d'entrée unique
 * pour la Tâche 11 (matérialisation `PlanningSeries` → `SessionBooking`).
 *
 * Compose, à l'intérieur du client de TRANSACTION fourni par l'appelant
 * (jamais `prisma` global — l'appelant ouvre sa propre transaction
 * sérialisable, voir « Operational planning » du spec) :
 *   - identité/périmètre pédagogique (lib/planning/identities.ts) ;
 *   - disponibilité effective du coach (lib/planning/effective-availability.ts) ;
 *   - conflits Élève / Coach / Stage, via UN SEUL prédicat de chevauchement
 *     partagé (`rangesOverlap`) — jamais réimplémenté trois fois.
 *
 * Les contraintes d'exclusion PostgreSQL (migrations
 * 20260201201415_add_session_overlap_prevention et
 * 20260906200000_core_family_academic_planning_expand) restent la dernière
 * ligne de défense pour les conflits Élève/Coach sur `SessionBooking` ; ce
 * module donne des messages utiles AVANT de les atteindre, et est la SEULE
 * protection pour les conflits Stage (aucune contrainte base ne les couvre).
 *
 * ── Granularité du conflit Stage ────────────────────────────────────────────
 * Coach : `StageSession.coachId` référence directement `CoachProfile.id` et
 * porte des horaires précis (`startAt`/`endAt`) — comparaison directe.
 *
 * Élève : `StageReservation` relie un élève à un `Stage` (une plage de
 * dates), jamais à une `StageSession` précise. La granularité séance PAR
 * séance reste néanmoins dérivable : un élève réservé sur un stage assiste à
 * TOUTES les séances de CE stage (`StageSession.stageId`), donc on charge les
 * `StageSession` des stages sur lesquels l'élève a une réservation non
 * annulée, et on leur applique le même prédicat de chevauchement horaire —
 * jamais la plage `Stage.startDate`/`endDate` entière comme un blackout
 * grossier, puisque la granularité fine est disponible par cette jointure.
 * Un stage sans séance programmée ne produit simplement aucun conflit.
 *
 * ── Dérogations ADMIN ────────────────────────────────────────────────────────
 * ASSISTANTE n'a AUCUNE dérogation : le type `PlanningInvariantRequester`
 * n'expose même pas de champ `override` pour cette branche, et
 * `evaluatePlanningInvariants` re-vérifie ceci à l'exécution (un
 * contournement `as any` resterait bloqué). ADMIN ne peut utiliser qu'un code
 * de dérogation ÉNUMÉRÉ et NON temporel — voir `PlanningOverrideCode`
 * ci-dessous pour le choix retenu et sa justification. Les conflits Élève,
 * Coach et Stage, ainsi que la disponibilité effective (temporelle par
 * nature : créneaux, blackouts, fenêtres de validité), ne sont JAMAIS
 * dérogeables : `evaluatePlanningInvariants` ne consulte la dérogation que
 * pour les échecs d'identité, structurellement.
 */

import type { Prisma, SessionStatus } from '@prisma/client';
import {
  loadPlanningIdentitySnapshot,
  verifyPlanningIdentities,
  type LoadPlanningIdentitySnapshotParams,
  type PlanningIdentityFailure,
  type PlanningIdentityFailureReason,
  type PlanningIdentitySnapshot,
} from './identities';
import {
  loadEffectiveAvailability,
  type AvailabilityCandidate,
  type AvailabilityCheck,
  type CoachAvailabilityWindow,
} from './effective-availability';

export { isAssignmentActiveAt } from './identities';
export { resolveEffectiveAvailability } from './effective-availability';

// ── Prédicat de chevauchement partagé ────────────────────────────────────────

/**
 * SEULE implémentation, dans tout le domaine planning, du test de
 * chevauchement de deux intervalles demi-ouverts [start, end). Réutilisée par
 * les trois contrôles (élève, coach, stage) ci-dessous — jamais réécrite.
 *
 * Deux créneaux qui se touchent exactement (l'un finit quand l'autre
 * commence) ne se chevauchent PAS : les comparaisons sont strictes.
 */
export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

export interface TimeRange {
  readonly start: Date;
  readonly end: Date;
}

/** `true` si `candidate` chevauche au moins un intervalle de `existing`. */
export function hasOverlappingRange(candidate: TimeRange, existing: readonly TimeRange[]): boolean {
  return existing.some((range) => rangesOverlap(candidate.start, candidate.end, range.start, range.end));
}

/** Combine une date (heure ignorée) et une heure locale `"HH:MM"` en `Date`. */
export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes),
  );
}

/** Statuts `SessionBooking` considérés actifs — même ensemble que les
 * contraintes d'exclusion PostgreSQL existantes. */
export const ACTIVE_BOOKING_STATUSES: readonly SessionStatus[] = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'];

// ── Dérogations ADMIN ────────────────────────────────────────────────────────

/**
 * Ensemble FERMÉ des codes de dérogation ADMIN, tous NON temporels.
 *
 * Choix retenu, minimal et documenté (aucune autre catégorie d'échec n'est
 * dérogeable) :
 *   - `COACH_CAPABILITY_NOT_DECLARED` : le coach ne déclare pas, via ses
 *     matières génériques (`CoachProfile.subjects`), une capacité couvrant
 *     formellement ce cours — mais le staff sait, par ailleurs, que ce coach
 *     peut l'enseigner (ex. capacité réelle non encore renseignée dans le
 *     profil). C'est un fait NON temporel : il ne dépend ni de la date, ni de
 *     l'heure, ni d'un état de conflit.
 *
 * Explicitement EXCLUS, et pourquoi :
 *   - `COURSE_NOT_IN_STUDENT_MAP` : protège l'intégrité de la carte scolaire
 *     (Tâche 6) — jamais une question d'opportunité staff, une dérogation ici
 *     reviendrait à planifier un cours que l'élève ne suit pas réellement.
 *   - `ASSIGNMENT_NOT_FOUND` / `ASSIGNMENT_PARTICIPANT_MISMATCH` : référence
 *     d'assignation fondamentalement fausse, jamais une question de nuance.
 *   - `ASSIGNMENT_NOT_ACTIVE` : l'assignation elle-même n'autorise plus rien
 *     entre ce coach et cet élève à cette date — dérogez l'assignation
 *     (réactivez-la), jamais ce contrôle.
 *   - `ASSIGNMENT_COURSE_NOT_IN_SCOPE` : le périmètre de cours d'une
 *     assignation est le résultat auditable de `classifyAssignmentCourseScope`
 *     (Tâche 8/9) ; le dérober ici court-circuiterait exactement l'invariant
 *     que ces tâches ont construit. La correction légitime passe par une
 *     vérification staff de l'assignation (`courseScopeState`
 *     `STAFF_VERIFIED`), pas par une dérogation de planification.
 *   - Disponibilité effective (blackout, fenêtre de validité, absence de
 *     motif récurrent) : temporelle par construction, donc hors du périmètre
 *     « non temporel » du spec.
 *   - Conflits Élève / Coach / Stage : interdits de dérogation par le spec,
 *     sans exception.
 */
export type PlanningOverrideCode = 'COACH_CAPABILITY_NOT_DECLARED';

export interface PlanningOverrideRequest {
  readonly code: PlanningOverrideCode;
  readonly reason: string;
}

/**
 * Type discriminé sur le rôle de l'acteur : la branche ASSISTANTE n'a
 * structurellement PAS de champ `override` — impossible à construire à la
 * compilation, jamais un booléen générique `allowOverride`.
 */
export type PlanningInvariantRequester =
  | { readonly role: 'ASSISTANTE'; readonly actorId: string }
  | { readonly role: 'ADMIN'; readonly actorId: string; readonly override?: PlanningOverrideRequest };

/** Association échec d'identité → code de dérogation qui peut le lever. */
const OVERRIDABLE_IDENTITY_REASONS: Partial<
  Record<PlanningIdentityFailureReason, PlanningOverrideCode>
> = {
  COACH_CAPABILITY_MISSING: 'COACH_CAPABILITY_NOT_DECLARED',
};

/**
 * Garde d'exécution : le type interdit déjà à ASSISTANTE de porter une
 * dérogation, mais un appelant JavaScript non typé ou un `as any` ne passerait
 * pas par le compilateur (même garde défensive que
 * `assertChosenCoursesAreWritable` dans lib/curriculum/enrollment.ts).
 */
function assertRequesterOverrideIsWellFormed(requester: PlanningInvariantRequester): void {
  const untyped = requester as { role: string; override?: unknown };
  if (untyped.role !== 'ADMIN' && untyped.override !== undefined) {
    throw new Error('Seul ADMIN peut fournir une dérogation de planification');
  }
}

// ── Résultat ─────────────────────────────────────────────────────────────────

export type PlanningInvariantFailure =
  | ({ readonly kind: 'IDENTITY' } & PlanningIdentityFailure)
  | { readonly kind: 'AVAILABILITY'; readonly reason: AvailabilityCheck['reason']; readonly message: string }
  | { readonly kind: 'STUDENT_CONFLICT'; readonly message: string }
  | { readonly kind: 'COACH_CONFLICT'; readonly message: string }
  | { readonly kind: 'STAGE_CONFLICT'; readonly message: string };

export type PlanningInvariantResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: readonly PlanningInvariantFailure[] };

/** Données déjà chargées nécessaires à l'évaluation PURE des invariants. */
export interface PlanningInvariantData {
  readonly identitySnapshot: PlanningIdentitySnapshot;
  readonly availability: AvailabilityCheck;
  readonly candidateRange: TimeRange;
  readonly studentConflicts: readonly TimeRange[];
  readonly coachConflicts: readonly TimeRange[];
  readonly stageConflicts: readonly TimeRange[];
}

/**
 * Cœur PUR : évalue tous les invariants à partir de données déjà chargées,
 * applique une éventuelle dérogation ADMIN, retourne TOUS les échecs
 * applicables (pas seulement le premier) pour un message utile.
 */
export function evaluatePlanningInvariants(
  data: PlanningInvariantData,
  requester: PlanningInvariantRequester,
): PlanningInvariantResult {
  assertRequesterOverrideIsWellFormed(requester);
  const override = requester.role === 'ADMIN' ? requester.override : undefined;

  const failures: PlanningInvariantFailure[] = [];

  for (const failure of verifyPlanningIdentities(data.identitySnapshot)) {
    if (override && OVERRIDABLE_IDENTITY_REASONS[failure.reason] === override.code) continue;
    failures.push({ kind: 'IDENTITY', ...failure });
  }

  if (!data.availability.available) {
    failures.push({
      kind: 'AVAILABILITY',
      reason: data.availability.reason,
      message: "Le créneau demandé ne correspond à aucune disponibilité effective du coach",
    });
  }

  if (hasOverlappingRange(data.candidateRange, data.studentConflicts)) {
    failures.push({
      kind: 'STUDENT_CONFLICT',
      message: "L'élève a déjà une réservation active sur ce créneau",
    });
  }

  if (hasOverlappingRange(data.candidateRange, data.coachConflicts)) {
    failures.push({
      kind: 'COACH_CONFLICT',
      message: 'Le coach a déjà une réservation active sur ce créneau',
    });
  }

  if (hasOverlappingRange(data.candidateRange, data.stageConflicts)) {
    failures.push({
      kind: 'STAGE_CONFLICT',
      message: 'Un stage occupe déjà ce créneau pour cet élève ou ce coach',
    });
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

// ── Enveloppe impure : chargement transactionnel ─────────────────────────────

export interface VerifyPlanningInvariantsInput extends LoadPlanningIdentitySnapshotParams {
  readonly startTime: string;
  readonly endTime: string;
  /** Occurrence à exclure des contrôles de conflit (ré-édition de sa propre réservation). */
  readonly excludeSessionBookingId?: string;
}

async function loadConflictingBookingRanges(
  tx: Prisma.TransactionClient,
  where: Prisma.SessionBookingWhereInput,
): Promise<TimeRange[]> {
  const rows = await tx.sessionBooking.findMany({
    where,
    select: { scheduledDate: true, startTime: true, endTime: true },
  });
  return rows.map((row) => ({
    start: combineDateAndTime(row.scheduledDate, row.startTime),
    end: combineDateAndTime(row.scheduledDate, row.endTime),
  }));
}

/**
 * Séances de stage d'un élève dérivées de ses réservations non annulées : cf.
 * la note de granularité en tête de fichier — jointure `StageReservation` →
 * `Stage` → `StageSession`, jamais la plage `Stage.startDate`/`endDate` brute.
 */
async function loadStudentStageConflictRanges(
  tx: Prisma.TransactionClient,
  studentProfileId: string,
): Promise<TimeRange[]> {
  const reservations = await tx.stageReservation.findMany({
    where: {
      studentId: studentProfileId,
      stageId: { not: null },
      // `richStatus` est nullable (compat historique) : `NOT { richStatus: 'CANCELLED' }`
      // écarterait une réservation à richStatus NULL (logique SQL à trois
      // valeurs). NULL = non annulée, donc à considérer — même convention
      // NULL-safe que app/api/assistante/planning/route.ts et
      // app/api/assistante/sessions/route.ts.
      AND: [
        { OR: [{ richStatus: null }, { NOT: { richStatus: 'CANCELLED' } }] },
        { NOT: { status: 'CANCELLED' } },
      ],
    },
    select: { stageId: true },
  });

  const stageIds = [...new Set(reservations.map((row) => row.stageId).filter((id): id is string => id !== null))];
  if (stageIds.length === 0) return [];

  const sessions = await tx.stageSession.findMany({
    where: { stageId: { in: stageIds } },
    select: { startAt: true, endAt: true },
  });
  return sessions.map((session) => ({ start: session.startAt, end: session.endAt }));
}

async function loadCoachStageConflictRanges(
  tx: Prisma.TransactionClient,
  coachProfileId: string,
): Promise<TimeRange[]> {
  const sessions = await tx.stageSession.findMany({
    where: { coachId: coachProfileId },
    select: { startAt: true, endAt: true },
  });
  return sessions.map((session) => ({ start: session.startAt, end: session.endAt }));
}

/**
 * Point d'entrée impur pour la Tâche 11 : charge TOUT depuis le client de
 * transaction fourni, puis délègue à `evaluatePlanningInvariants` (pur).
 */
export async function verifyPlanningInvariants(
  tx: Prisma.TransactionClient,
  input: VerifyPlanningInvariantsInput,
  requester: PlanningInvariantRequester,
): Promise<PlanningInvariantResult> {
  assertRequesterOverrideIsWellFormed(requester);

  const candidate: AvailabilityCandidate = {
    date: input.occurrenceDate,
    startTime: input.startTime,
    endTime: input.endTime,
  };
  const candidateRange: TimeRange = {
    start: combineDateAndTime(input.occurrenceDate, input.startTime),
    end: combineDateAndTime(input.occurrenceDate, input.endTime),
  };

  const excludeClause: Prisma.SessionBookingWhereInput = input.excludeSessionBookingId
    ? { id: { not: input.excludeSessionBookingId } }
    : {};

  const [identitySnapshot, availability, studentConflicts, coachConflicts, studentStageConflicts, coachStageConflicts] =
    await Promise.all([
      loadPlanningIdentitySnapshot(tx, input),
      loadEffectiveAvailability(tx, input.coachProfileId, candidate),
      loadConflictingBookingRanges(tx, {
        studentProfileId: input.studentProfileId,
        scheduledDate: input.occurrenceDate,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        ...excludeClause,
      }),
      loadConflictingBookingRanges(tx, {
        coachProfileId: input.coachProfileId,
        scheduledDate: input.occurrenceDate,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        ...excludeClause,
      }),
      loadStudentStageConflictRanges(tx, input.studentProfileId),
      loadCoachStageConflictRanges(tx, input.coachProfileId),
    ]);

  return evaluatePlanningInvariants(
    {
      identitySnapshot,
      availability,
      candidateRange,
      studentConflicts,
      coachConflicts,
      stageConflicts: [...studentStageConflicts, ...coachStageConflicts],
    },
    requester,
  );
}

export type { CoachAvailabilityWindow };
