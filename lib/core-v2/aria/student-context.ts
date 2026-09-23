/**
 * ARIA's Core v2 native student context.
 *
 * The one place that resolves "who is this ARIA student, and what does
 * Core v2 canonically say about their schooling" for the CORE_V2 surface
 * (/api/v2/aria/**). Fail-closed, single authority: no legacy fallback is
 * possible from here because this module never touches the legacy
 * database at all — that's structural, not a runtime check.
 *
 * "Current enrollment" is never inferred by createdAt/updatedAt/latest-row:
 * it is the enrollment with `status: 'ACTIVE'` whose `academicYear.status`
 * is `'CURRENT'`. The (studentId, academicYearId) unique constraint plus
 * the single-CURRENT-year partial unique index (migration 0006) make more
 * than one such enrollment a structural impossibility today — the guard
 * below is defense-in-depth against a future relaxation of either
 * constraint, not a reachable branch.
 */
import type { Subject } from '@prisma/client';
import type { AcademicTrack, GradeLevel, Prisma, StmgPathway } from '@/core-v2/generated/client';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import type { PrismaClient } from '@/core-v2/generated/client';
import { resolveLegacySubjectForCourse } from '@/lib/curriculum/legacy-migration-map';
import { NotFoundError } from '@/lib/core-v2/errors';
import { assertSelfServiceRole } from '@/lib/core-v2/rbac';

const coreV2AriaStudentSelect = {
  id: true,
  user: { select: { id: true, firstName: true, lastName: true } },
  academicYearEnrollments: {
    where: { status: 'ACTIVE', academicYear: { status: 'CURRENT' } },
    take: 2,
    select: {
      status: true,
      gradeLevel: true,
      academicTrack: true,
      stmgPathway: true,
      schoolingStatus: true,
      school: true,
      academicYear: { select: { status: true } },
      courseEnrollments: { select: { courseKey: true, kind: true } },
    },
  },
} satisfies Prisma.StudentSelect;

export interface CoreV2AriaAcademicEnrollment {
  readonly courseKey: string;
  readonly kind: 'SPECIALTY' | 'OPTION';
}

export interface CoreV2AriaStudentContext {
  readonly studentId: string;
  readonly userId: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly gradeLevel: GradeLevel;
  readonly academicTrack: AcademicTrack;
  readonly stmgPathway: StmgPathway | null;
  readonly schoolingStatus: string | null;
  readonly school: string | null;
  /**
   * Derived via `resolveLegacySubjectForCourse` for the shared
   * `resolveAriaCurriculum` contract (`specialties: Subject[]`, pre-dating
   * Core v2). A SPECIALTY course key with no canonical legacy-subject
   * correspondence is excluded, never guessed.
   */
  readonly specialties: readonly Subject[];
  readonly academicEnrollments: readonly CoreV2AriaAcademicEnrollment[];
}

/**
 * A `NotFoundError` (maps to HTTP 404 via `defineStaffRoute`'s
 * `failFromError`) — the exact analogue of the legacy path's
 * `AriaError('NOT_ENROLLED', 404, ...)`, never a generic 500.
 */
export class CoreV2AriaStudentNotFoundError extends NotFoundError {
  constructor() {
    super('No active Core v2 student enrollment was found.');
  }
}

export class CoreV2AriaMultipleActiveEnrollmentsError extends Error {
  constructor(studentId: string, count: number) {
    super(
      `CORE_V2_MULTIPLE_ACTIVE_ENROLLMENTS: student ${studentId} has ${count} ACTIVE enrollments in the CURRENT academic year — data integrity issue, refusing to guess which one is canonical.`,
    );
    this.name = 'CoreV2AriaMultipleActiveEnrollmentsError';
  }
}

export async function loadCoreV2AriaStudentContext(
  client: PrismaClient,
  ctx: ServiceContext,
): Promise<CoreV2AriaStudentContext> {
  assertSelfServiceRole(ctx.actor, 'ELEVE');
  const student = await client.student.findUnique({
    where: { userId: ctx.actor.userId },
    select: coreV2AriaStudentSelect,
  });
  if (!student) throw new CoreV2AriaStudentNotFoundError();

  const currentActive = student.academicYearEnrollments;
  if (currentActive.length === 0) throw new CoreV2AriaStudentNotFoundError();
  if (currentActive.length > 1) {
    throw new CoreV2AriaMultipleActiveEnrollmentsError(student.id, currentActive.length);
  }
  const enrollment = currentActive[0]!;

  const academicEnrollments: CoreV2AriaAcademicEnrollment[] = enrollment.courseEnrollments.map((course) => ({
    courseKey: course.courseKey,
    kind: course.kind,
  }));

  const specialties = academicEnrollments
    .filter((e) => e.kind === 'SPECIALTY')
    .map((e) => resolveLegacySubjectForCourse(e.courseKey, enrollment.gradeLevel))
    .filter((subject): subject is string => subject !== null) as unknown as readonly Subject[];

  return {
    studentId: student.id,
    userId: student.user.id,
    firstName: student.user.firstName ?? null,
    lastName: student.user.lastName ?? null,
    gradeLevel: enrollment.gradeLevel,
    academicTrack: enrollment.academicTrack,
    stmgPathway: enrollment.stmgPathway ?? null,
    schoolingStatus: enrollment.schoolingStatus ?? null,
    school: enrollment.school ?? null,
    specialties,
    academicEnrollments,
  };
}
