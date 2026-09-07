/**
 * Invariants d'identité pédagogique pour une occurrence de planning.
 *
 * Couvre les deux premières puces de « Operational planning »
 * (docs/superpowers/specs/2026-09-06-core-family-academic-planning-design.md) :
 *   - l'élève existe et le cours appartient à sa carte scolaire courante ;
 *   - l'assignation est active pour Élève, Coach et Cours à la date de
 *     l'occurrence, et le coach déclare une capacité couvrant ce cours.
 *
 * Fonction PURE (`verifyPlanningIdentities`) + enveloppe Prisma fine
 * (`loadPlanningIdentitySnapshot`), même découpage que
 * `lib/curriculum/enrollment.ts` et `lib/assignments/allowed-courses.ts`.
 *
 * Périmètre de cours de l'assignation : `academicCourseKeys` n'est rempli que
 * lorsque `classifyAssignmentCourseScope` (lib/assignments/allowed-courses.ts)
 * a pu résoudre CHAQUE matière historique sans ambiguïté (états
 * BACKFILL_AUTO ou STAFF_VERIFIED) ; une assignation BACKFILL_UNRESOLVED ou
 * BACKFILL_AMBIGUOUS porte `academicCourseKeys: []` — elle échoue donc
 * naturellement `ASSIGNMENT_COURSE_NOT_IN_SCOPE` pour n'importe quel cours,
 * sans cas particulier à coder ici.
 */

import type { AssignmentStatus, Prisma } from '@prisma/client';
import {
  listFollowedCourses,
  listStudentEnrollments,
  resolveStudentCourses,
  type EnrollmentRecord,
} from '@/lib/curriculum/enrollment';
import type { StudentAcademicIdentity } from '@/lib/curriculum/validation';
import { coachCapableCourseKeys } from '@/lib/assignments/allowed-courses';
import { parseSubjects } from '@/lib/utils/subjects';

/** Raison précise d'un échec d'identité — jamais un simple booléen. */
export type PlanningIdentityFailureReason =
  | 'STUDENT_NOT_FOUND'
  | 'COURSE_NOT_IN_STUDENT_MAP'
  | 'ASSIGNMENT_NOT_FOUND'
  | 'ASSIGNMENT_PARTICIPANT_MISMATCH'
  | 'ASSIGNMENT_NOT_ACTIVE'
  | 'ASSIGNMENT_COURSE_NOT_IN_SCOPE'
  | 'COACH_CAPABILITY_MISSING';

export interface PlanningIdentityFailure {
  readonly reason: PlanningIdentityFailureReason;
  readonly message: string;
}

/** Vue minimale d'une `CoachStudentAssignment` nécessaire à ces contrôles. */
export interface PlanningAssignmentSnapshot {
  readonly id: string;
  readonly studentId: string;
  readonly coachId: string;
  readonly status: AssignmentStatus;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly academicCourseKeys: readonly string[];
}

export interface PlanningIdentitySnapshot {
  readonly occurrenceDate: Date;
  readonly studentProfileId: string;
  readonly coachProfileId: string;
  readonly academicCourseKey: string;
  readonly student: { readonly id: string; readonly identity: StudentAcademicIdentity } | null;
  readonly studentEnrollments: readonly EnrollmentRecord[];
  readonly assignment: PlanningAssignmentSnapshot | null;
  /** `parseSubjects(coachProfile.subjects)` — matières génériques déclarées par le coach. */
  readonly coachSubjects: readonly string[];
}

/**
 * Une assignation est active à `date` : statut ACTIVE, démarrée, pas encore
 * terminée. Même sémantique que `activeAssignmentWhere`
 * (lib/rbac/coach-student-access.ts), réécrite en pur pour s'appliquer à la
 * date de l'OCCURRENCE plutôt qu'à « maintenant ».
 */
export function isAssignmentActiveAt(
  assignment: Pick<PlanningAssignmentSnapshot, 'status' | 'startsAt' | 'endsAt'>,
  date: Date,
): boolean {
  if (assignment.status !== 'ACTIVE') return false;
  if (assignment.startsAt > date) return false;
  if (assignment.endsAt && assignment.endsAt < date) return false;
  return true;
}

/**
 * Vérifie l'identité/le périmètre pédagogique d'une occurrence, à partir de
 * données DÉJÀ CHARGÉES. Retourne la liste de TOUS les échecs applicables
 * (tableau vide = tout est valide) plutôt qu'un simple booléen, pour que
 * l'appelant puisse construire un message utile et, pour ADMIN, cibler une
 * dérogation précise.
 */
export function verifyPlanningIdentities(
  snapshot: PlanningIdentitySnapshot,
): readonly PlanningIdentityFailure[] {
  const failures: PlanningIdentityFailure[] = [];

  if (!snapshot.student) {
    failures.push({
      reason: 'STUDENT_NOT_FOUND',
      message: `Élève introuvable (${snapshot.studentProfileId})`,
    });
  } else {
    const followed = listFollowedCourses(
      resolveStudentCourses(snapshot.student.identity, snapshot.studentEnrollments),
    );
    const followedKeys = new Set(followed.map((view) => view.course.courseKey));
    if (!followedKeys.has(snapshot.academicCourseKey)) {
      failures.push({
        reason: 'COURSE_NOT_IN_STUDENT_MAP',
        message: `Le cours ${snapshot.academicCourseKey} ne fait pas partie de la carte scolaire actuelle de l'élève`,
      });
    }
  }

  if (!snapshot.assignment) {
    failures.push({
      reason: 'ASSIGNMENT_NOT_FOUND',
      message: 'Assignation introuvable',
    });
  } else if (
    snapshot.assignment.studentId !== snapshot.studentProfileId ||
    snapshot.assignment.coachId !== snapshot.coachProfileId
  ) {
    failures.push({
      reason: 'ASSIGNMENT_PARTICIPANT_MISMATCH',
      message: "L'assignation ne relie pas cet élève et ce coach",
    });
  } else {
    if (!isAssignmentActiveAt(snapshot.assignment, snapshot.occurrenceDate)) {
      failures.push({
        reason: 'ASSIGNMENT_NOT_ACTIVE',
        message: "L'assignation n'est pas active à la date de cette occurrence",
      });
    }
    if (!snapshot.assignment.academicCourseKeys.includes(snapshot.academicCourseKey)) {
      failures.push({
        reason: 'ASSIGNMENT_COURSE_NOT_IN_SCOPE',
        message: `Le cours ${snapshot.academicCourseKey} n'est pas dans le périmètre résolu de cette assignation`,
      });
    }
  }

  if (!coachCapableCourseKeys(snapshot.coachSubjects).has(snapshot.academicCourseKey)) {
    failures.push({
      reason: 'COACH_CAPABILITY_MISSING',
      message: 'Le coach ne déclare aucune matière couvrant ce cours',
    });
  }

  return failures;
}

// ── Enveloppe impure ─────────────────────────────────────────────────────────

export interface LoadPlanningIdentitySnapshotParams {
  readonly occurrenceDate: Date;
  readonly studentProfileId: string;
  readonly coachProfileId: string;
  readonly assignmentId: string;
  readonly academicCourseKey: string;
}

/**
 * Charge, via le client de TRANSACTION fourni (jamais le `prisma` global —
 * `Task 11` appellera ceci depuis sa propre transaction sérialisable), tout
 * ce dont `verifyPlanningIdentities` a besoin.
 */
export async function loadPlanningIdentitySnapshot(
  tx: Prisma.TransactionClient,
  params: LoadPlanningIdentitySnapshotParams,
): Promise<PlanningIdentitySnapshot> {
  const [studentRow, assignmentRow, coachProfileRow, enrollments] = await Promise.all([
    tx.student.findUnique({
      where: { id: params.studentProfileId },
      select: { id: true, gradeLevel: true, academicTrack: true, stmgPathway: true },
    }),
    tx.coachStudentAssignment.findUnique({
      where: { id: params.assignmentId },
      select: {
        id: true,
        studentId: true,
        coachId: true,
        status: true,
        startsAt: true,
        endsAt: true,
        academicCourseKeys: true,
      },
    }),
    tx.coachProfile.findUnique({
      where: { id: params.coachProfileId },
      select: { subjects: true },
    }),
    listStudentEnrollments(params.studentProfileId, tx),
  ]);

  return {
    occurrenceDate: params.occurrenceDate,
    studentProfileId: params.studentProfileId,
    coachProfileId: params.coachProfileId,
    academicCourseKey: params.academicCourseKey,
    student: studentRow
      ? {
          id: studentRow.id,
          identity: {
            gradeLevel: studentRow.gradeLevel,
            academicTrack: studentRow.academicTrack,
            stmgPathway: studentRow.stmgPathway,
          },
        }
      : null,
    studentEnrollments: enrollments,
    assignment: assignmentRow,
    coachSubjects: coachProfileRow ? parseSubjects(coachProfileRow.subjects) : [],
  };
}
