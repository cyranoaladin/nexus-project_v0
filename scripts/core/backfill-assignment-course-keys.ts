/**
 * Backfill des périmètres de cours canoniques des `CoachStudentAssignment`
 * historiques (`Amendment 3` du plan `2026-09-06-core-family-academic-planning`).
 *
 * Pour chaque assignation ACTIVE qui n'est pas encore `STAFF_VERIFIED`,
 * calcule — via `lib/assignments/allowed-courses.ts` — quel(s) `courseKey`
 * du catalogue correspond réellement à chaque matière historique
 * (`subjects: Subject[]`), à partir des cours actuellement suivis par
 * l'élève et de la capacité déclarée du coach. Ne devine JAMAIS : un
 * candidat unique s'écrit (`BACKFILL_AUTO`), zéro ou plusieurs candidats
 * laissent `academicCourseKeys` vide et posent `courseScopeState` en
 * conséquence (`BACKFILL_UNRESOLVED` / `BACKFILL_AMBIGUOUS`) pour revue
 * humaine.
 *
 * Idempotent : une ligne déjà `STAFF_VERIFIED` n'est jamais chargée ; une
 * ligne dont l'état et les clés recalculés sont identiques à ce qui est déjà
 * en base n'est pas réécrite (pas de bruit `updatedAt`), qu'on soit en
 * dry-run ou en `--apply`. Rejouer le script ne change donc rien tant que les
 * données sources (inscriptions, capacités coach, catalogue) n'ont pas
 * changé.
 *
 * Usage :
 *   tsx scripts/core/backfill-assignment-course-keys.ts           # dry-run (rapport seul)
 *   tsx scripts/core/backfill-assignment-course-keys.ts --apply   # écrit en base
 */

import type { AssignmentCourseScopeState, Subject } from '@prisma/client';
import {
  classifyAssignmentCourseScope,
  type DerivedCourseScopeState,
} from '@/lib/assignments/allowed-courses';
import { listFollowedCourses, resolveStudentCourses, type EnrollmentRecord } from '@/lib/curriculum/enrollment';
import { parseSubjects } from '@/lib/utils/subjects';

export interface CandidateAssignmentRow {
  readonly id: string;
  readonly studentId: string;
  readonly coachId: string;
  readonly subjects: readonly Subject[];
  readonly courseScopeState: AssignmentCourseScopeState;
  readonly academicCourseKeys: readonly string[];
  readonly studentIdentity: Readonly<{
    gradeLevel: string | null;
    academicTrack: string | null;
    stmgPathway: string | null;
  }>;
  readonly enrollments: readonly EnrollmentRecord[];
  readonly coachSubjects: readonly string[];
}

export interface AssignmentCourseScopeDecision {
  readonly assignmentId: string;
  readonly nextState: DerivedCourseScopeState;
  readonly nextCourseKeys: readonly string[];
}

export type BackfillAssignmentCourseKeysPort = Readonly<{
  loadCandidateAssignments(): Promise<readonly CandidateAssignmentRow[]>;
  applyDecision(decision: AssignmentCourseScopeDecision): Promise<void>;
}>;

export interface BackfillRowOutcome {
  readonly assignmentId: string;
  readonly studentId: string;
  readonly coachId: string;
  readonly previousState: AssignmentCourseScopeState;
  readonly nextState: DerivedCourseScopeState;
  readonly previousCourseKeys: readonly string[];
  readonly nextCourseKeys: readonly string[];
  readonly changed: boolean;
}

export interface BackfillRunSummary {
  readonly scanned: number;
  readonly auto: number;
  readonly unresolved: number;
  readonly ambiguous: number;
  /** Nombre de lignes dont l'état ou les clés recalculés diffèrent de ce qui est stocké. */
  readonly changed: number;
  readonly rows: readonly BackfillRowOutcome[];
}

function sameCourseKeys(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((key, index) => key === sortedRight[index]);
}

/**
 * Cœur pur du backfill : calcule, pour chaque assignation candidate, l'état
 * et les clés recalculées, et détermine si une écriture serait nécessaire.
 * Aucun accès base ici — testable sans mock Prisma.
 */
export function planBackfill(rows: readonly CandidateAssignmentRow[]): BackfillRunSummary {
  const outcomes: BackfillRowOutcome[] = [];
  let auto = 0;
  let unresolved = 0;
  let ambiguous = 0;
  let changed = 0;

  for (const row of rows) {
    const followedCourses = listFollowedCourses(
      resolveStudentCourses(row.studentIdentity, row.enrollments),
    );
    const result = classifyAssignmentCourseScope({
      subjects: row.subjects,
      followedCourses,
      coachSubjects: row.coachSubjects,
    });

    if (result.state === 'BACKFILL_AUTO') auto += 1;
    else if (result.state === 'BACKFILL_UNRESOLVED') unresolved += 1;
    else ambiguous += 1;

    const rowChanged = row.courseScopeState !== result.state
      || !sameCourseKeys(row.academicCourseKeys, result.academicCourseKeys);
    if (rowChanged) changed += 1;

    outcomes.push({
      assignmentId: row.id,
      studentId: row.studentId,
      coachId: row.coachId,
      previousState: row.courseScopeState,
      nextState: result.state,
      previousCourseKeys: row.academicCourseKeys,
      nextCourseKeys: result.academicCourseKeys,
      changed: rowChanged,
    });
  }

  return {
    scanned: rows.length,
    auto,
    unresolved,
    ambiguous,
    changed,
    rows: outcomes,
  };
}

export async function runBackfill(
  port: BackfillAssignmentCourseKeysPort,
  options: Readonly<{ apply: boolean }>,
): Promise<BackfillRunSummary> {
  const rows = await port.loadCandidateAssignments();
  const summary = planBackfill(rows);
  if (options.apply) {
    for (const row of summary.rows) {
      if (!row.changed) continue;
      await port.applyDecision({
        assignmentId: row.assignmentId,
        nextState: row.nextState,
        nextCourseKeys: row.nextCourseKeys,
      });
    }
  }
  return summary;
}

// ── Adaptateur Prisma ────────────────────────────────────────────────────────

type BackfillPrismaClient = Readonly<{
  coachStudentAssignment: {
    findMany(args: unknown): Promise<readonly {
      id: string;
      studentId: string;
      coachId: string;
      subjects: Subject[];
      courseScopeState: AssignmentCourseScopeState;
      academicCourseKeys: string[];
      student: { gradeLevel: string; academicTrack: string; stmgPathway: string | null };
      coach: { subjects: unknown };
    }[]>;
    update(args: unknown): Promise<unknown>;
  };
  studentAcademicEnrollment: {
    findMany(args: unknown): Promise<readonly { studentId: string; courseKey: string; kind: string; source: string }[]>;
  };
}>;

export function createPrismaBackfillPort(client: BackfillPrismaClient): BackfillAssignmentCourseKeysPort {
  return Object.freeze({
    async loadCandidateAssignments() {
      const assignments = await client.coachStudentAssignment.findMany({
        where: { status: 'ACTIVE', courseScopeState: { not: 'STAFF_VERIFIED' } },
        select: {
          id: true,
          studentId: true,
          coachId: true,
          subjects: true,
          courseScopeState: true,
          academicCourseKeys: true,
          student: { select: { gradeLevel: true, academicTrack: true, stmgPathway: true } },
          coach: { select: { subjects: true } },
        },
        orderBy: { id: 'asc' },
      });

      const studentIds = [...new Set(assignments.map((assignment) => assignment.studentId))];
      const enrollments = studentIds.length === 0
        ? []
        : await client.studentAcademicEnrollment.findMany({
          where: { studentId: { in: studentIds } },
          select: { studentId: true, courseKey: true, kind: true, source: true },
          orderBy: { courseKey: 'asc' },
        });

      const enrollmentsByStudent = new Map<string, EnrollmentRecord[]>();
      for (const enrollment of enrollments) {
        const list = enrollmentsByStudent.get(enrollment.studentId) ?? [];
        list.push({
          courseKey: enrollment.courseKey,
          kind: enrollment.kind as EnrollmentRecord['kind'],
          source: enrollment.source as EnrollmentRecord['source'],
        });
        enrollmentsByStudent.set(enrollment.studentId, list);
      }

      return assignments.map((assignment) => Object.freeze({
        id: assignment.id,
        studentId: assignment.studentId,
        coachId: assignment.coachId,
        subjects: assignment.subjects,
        courseScopeState: assignment.courseScopeState,
        academicCourseKeys: assignment.academicCourseKeys,
        studentIdentity: {
          gradeLevel: assignment.student.gradeLevel,
          academicTrack: assignment.student.academicTrack,
          stmgPathway: assignment.student.stmgPathway,
        },
        enrollments: enrollmentsByStudent.get(assignment.studentId) ?? [],
        coachSubjects: parseSubjects(assignment.coach.subjects),
      }));
    },
    async applyDecision(decision) {
      await client.coachStudentAssignment.update({
        where: { id: decision.assignmentId },
        data: {
          courseScopeState: decision.nextState,
          academicCourseKeys: [...decision.nextCourseKeys],
        },
      });
    },
  });
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const USAGE = 'Usage: tsx scripts/core/backfill-assignment-course-keys.ts [--apply]';

function parseArguments(args: readonly string[]): Readonly<{ apply: boolean }> | null {
  const allowed = new Set(['--apply']);
  if (new Set(args).size !== args.length) return null;
  for (const argument of args) {
    if (!allowed.has(argument)) return null;
  }
  return { apply: args.includes('--apply') };
}

type MainDependencies = Readonly<{
  port?: BackfillAssignmentCourseKeysPort;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}>;

export async function main(
  args: readonly string[],
  injected?: MainDependencies,
): Promise<number> {
  const writeOut = injected?.stdout ?? ((line: string) => console.log(line));
  const writeError = injected?.stderr ?? ((line: string) => console.error(line));
  const parsed = parseArguments(args);
  if (parsed === null) {
    writeError(USAGE);
    return 2;
  }

  let disconnect: (() => Promise<void>) | undefined;
  let port = injected?.port;
  if (port === undefined) {
    const { prisma } = await import('@/lib/prisma');
    port = createPrismaBackfillPort(prisma as unknown as BackfillPrismaClient);
    disconnect = () => prisma.$disconnect();
  }

  try {
    const summary = await runBackfill(port, { apply: parsed.apply });
    writeOut(JSON.stringify({
      event: 'ASSIGNMENT_COURSE_SCOPE_BACKFILL',
      mode: parsed.apply ? 'APPLY' : 'DRY_RUN',
      scanned: summary.scanned,
      auto: summary.auto,
      unresolved: summary.unresolved,
      ambiguous: summary.ambiguous,
      changed: summary.changed,
    }));
    return 0;
  } catch (error) {
    writeError(JSON.stringify({
      event: 'ASSIGNMENT_COURSE_SCOPE_BACKFILL_FAILED',
      code: error instanceof Error ? error.message : 'UNEXPECTED_ERROR',
    }));
    return 1;
  } finally {
    await disconnect?.();
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  }).catch(() => {
    console.error(JSON.stringify({ event: 'ASSIGNMENT_COURSE_SCOPE_BACKFILL_FAILED', code: 'UNEXPECTED_ERROR' }));
    process.exitCode = 1;
  });
}
