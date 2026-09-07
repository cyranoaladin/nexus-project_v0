/**
 * Rapport en lecture seule de l'état de migration du cœur métier.
 *
 * Sert de source unique pour les compteurs de readiness go-live que la
 * répétition de migration (Task 18/19 du plan
 * `2026-09-06-core-family-academic-planning`) consomme tels quels :
 * `ACTIVE_ASSIGNMENT_UNRESOLVED` et `ACTIVE_ASSIGNMENT_AMBIGUOUS` doivent
 * être à zéro avant de considérer le périmètre de cours des assignations
 * comme prêt. Ce script ne modifie jamais rien — le seul écrivain est
 * `scripts/core/backfill-assignment-course-keys.ts`.
 *
 * Rapporte également, depuis la Tâche 12, les gates de résolution de profil
 * des `SessionBooking` ACTIFS/FUTURS que la Tâche 10/11 matérialisent avec
 * `studentProfileId`/`coachProfileId` : `ACTIVE_FUTURE_SESSION_WITHOUT_
 * STUDENT_PROFILE` et `ACTIVE_FUTURE_SESSION_WITHOUT_COACH_PROFILE` doivent
 * être à zéro avant de considérer les lecteurs basés sur profil (ex.
 * `app/api/assistante/planning/route.ts`) prêts pour la production — c'est un
 * gate de la répétition de migration (Task 18/19), jamais un contrôle à
 * l'exécution d'une route de lecture.
 *
 * Usage : tsx scripts/core/report-core-migration-state.ts
 */

import { ACTIVE_BOOKING_STATUSES } from '@/lib/planning/invariants';
import { tunisTodayUtcMidnight } from '@/lib/planning/series';

export interface AssignmentCourseScopeCounts {
  readonly STAFF_VERIFIED: number;
  readonly BACKFILL_AUTO: number;
  readonly BACKFILL_UNRESOLVED: number;
  readonly BACKFILL_AMBIGUOUS: number;
}

export interface CoreMigrationStateReport {
  /** Assignations ACTIVE uniquement — seules celles-ci accordent un accès dossier courant. */
  readonly activeAssignmentsByCourseScopeState: AssignmentCourseScopeCounts;
  /** Toutes assignations, tous statuts confondus — pour audit, sans effet sur les gates. */
  readonly allAssignmentsByCourseScopeState: AssignmentCourseScopeCounts;
  /** Gate : doit être 0 avant de considérer le périmètre de cours prêt. */
  readonly ACTIVE_ASSIGNMENT_UNRESOLVED: number;
  /** Gate : doit être 0 avant de considérer le périmètre de cours prêt. */
  readonly ACTIVE_ASSIGNMENT_AMBIGUOUS: number;
  /** Gate : doit être 0 avant de basculer un lecteur staff sur `studentProfileId`. */
  readonly ACTIVE_FUTURE_SESSION_WITHOUT_STUDENT_PROFILE: number;
  /** Gate : doit être 0 avant de basculer un lecteur staff sur `coachProfileId`. */
  readonly ACTIVE_FUTURE_SESSION_WITHOUT_COACH_PROFILE: number;
}

const COURSE_SCOPE_STATES = ['STAFF_VERIFIED', 'BACKFILL_AUTO', 'BACKFILL_UNRESOLVED', 'BACKFILL_AMBIGUOUS'] as const;
export type CourseScopeState = (typeof COURSE_SCOPE_STATES)[number];

function emptyCounts(): Record<CourseScopeState, number> {
  return { STAFF_VERIFIED: 0, BACKFILL_AUTO: 0, BACKFILL_UNRESOLVED: 0, BACKFILL_AMBIGUOUS: 0 };
}

export type CourseScopeStateGroup = Readonly<{
  status: 'ACTIVE' | 'SUSPENDED' | 'ENDED';
  courseScopeState: CourseScopeState;
  count: number;
}>;

/** Sous-ensemble du rapport produit par `summarizeCoreMigrationState` (périmètre de cours des assignations, Tâche 8). */
export type CoreCourseScopeReport = Omit<
  CoreMigrationStateReport,
  'ACTIVE_FUTURE_SESSION_WITHOUT_STUDENT_PROFILE' | 'ACTIVE_FUTURE_SESSION_WITHOUT_COACH_PROFILE'
>;

/**
 * Agrège des lignes `groupBy(status, courseScopeState)` en le rapport final.
 * Pure — testable sans base et réutilisable si la requête change de forme.
 */
export function summarizeCoreMigrationState(groups: readonly CourseScopeStateGroup[]): CoreCourseScopeReport {
  const active: Record<CourseScopeState, number> = emptyCounts();
  const all: Record<CourseScopeState, number> = emptyCounts();

  for (const group of groups) {
    all[group.courseScopeState] = all[group.courseScopeState] + group.count;
    if (group.status === 'ACTIVE') {
      active[group.courseScopeState] = active[group.courseScopeState] + group.count;
    }
  }

  return {
    activeAssignmentsByCourseScopeState: active,
    allAssignmentsByCourseScopeState: all,
    ACTIVE_ASSIGNMENT_UNRESOLVED: active.BACKFILL_UNRESOLVED,
    ACTIVE_ASSIGNMENT_AMBIGUOUS: active.BACKFILL_AMBIGUOUS,
  };
}

// ── Gates de résolution de profil (Tâche 12) ────────────────────────────────

export interface PlanningProfileResolutionInput {
  readonly activeFutureSessionsWithoutStudentProfile: number;
  readonly activeFutureSessionsWithoutCoachProfile: number;
}

/**
 * Pure — met simplement en forme les deux compteurs déjà agrégés par
 * l'adaptateur Prisma, même découpage que `summarizeCoreMigrationState`.
 */
export function summarizePlanningProfileResolution(
  input: PlanningProfileResolutionInput,
): Pick<
  CoreMigrationStateReport,
  'ACTIVE_FUTURE_SESSION_WITHOUT_STUDENT_PROFILE' | 'ACTIVE_FUTURE_SESSION_WITHOUT_COACH_PROFILE'
> {
  return {
    ACTIVE_FUTURE_SESSION_WITHOUT_STUDENT_PROFILE: input.activeFutureSessionsWithoutStudentProfile,
    ACTIVE_FUTURE_SESSION_WITHOUT_COACH_PROFILE: input.activeFutureSessionsWithoutCoachProfile,
  };
}

// ── Adaptateur Prisma ────────────────────────────────────────────────────────

type ReportPrismaClient = Readonly<{
  coachStudentAssignment: {
    groupBy(args: unknown): Promise<readonly { status: string; courseScopeState: string; _count: { _all: number } }[]>;
  };
  sessionBooking: {
    count(args: unknown): Promise<number>;
  };
}>;

export async function loadCoreMigrationState(client: ReportPrismaClient): Promise<CoreMigrationStateReport> {
  const grouped = await client.coachStudentAssignment.groupBy({
    by: ['status', 'courseScopeState'],
    _count: { _all: true },
  });
  const groups: CourseScopeStateGroup[] = grouped.map((entry) => {
    if (!(COURSE_SCOPE_STATES as readonly string[]).includes(entry.courseScopeState)) {
      throw new Error(`CORE_MIGRATION_STATE_UNKNOWN_COURSE_SCOPE_STATE:${entry.courseScopeState}`);
    }
    return {
      status: entry.status as CourseScopeStateGroup['status'],
      courseScopeState: entry.courseScopeState as CourseScopeState,
      count: entry._count._all,
    };
  });

  const activeFutureBaseWhere = {
    scheduledDate: { gte: tunisTodayUtcMidnight() },
    status: { in: [...ACTIVE_BOOKING_STATUSES] },
  };
  const [withoutStudentProfile, withoutCoachProfile] = await Promise.all([
    client.sessionBooking.count({ where: { ...activeFutureBaseWhere, studentProfileId: null } }),
    client.sessionBooking.count({ where: { ...activeFutureBaseWhere, coachProfileId: null } }),
  ]);

  return {
    ...summarizeCoreMigrationState(groups),
    ...summarizePlanningProfileResolution({
      activeFutureSessionsWithoutStudentProfile: withoutStudentProfile,
      activeFutureSessionsWithoutCoachProfile: withoutCoachProfile,
    }),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

type MainDependencies = Readonly<{
  client?: ReportPrismaClient;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}>;

export async function main(injected?: MainDependencies): Promise<number> {
  const writeOut = injected?.stdout ?? ((line: string) => console.log(line));
  const writeError = injected?.stderr ?? ((line: string) => console.error(line));

  let disconnect: (() => Promise<void>) | undefined;
  let client = injected?.client;
  if (client === undefined) {
    const { prisma } = await import('@/lib/prisma');
    client = prisma as unknown as ReportPrismaClient;
    disconnect = () => (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect();
  }

  try {
    const report = await loadCoreMigrationState(client);
    writeOut(JSON.stringify({ event: 'CORE_MIGRATION_STATE', ...report }));
    return 0;
  } catch (error) {
    writeError(JSON.stringify({
      event: 'CORE_MIGRATION_STATE_FAILED',
      code: error instanceof Error ? error.message : 'UNEXPECTED_ERROR',
    }));
    return 1;
  } finally {
    await disconnect?.();
  }
}

if (require.main === module) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch(() => {
    console.error(JSON.stringify({ event: 'CORE_MIGRATION_STATE_FAILED', code: 'UNEXPECTED_ERROR' }));
    process.exitCode = 1;
  });
}
