/**
 * ONE ROW = ONE COACH + ONE STUDENT/YEAR + ONE COURSEKEY (ADR item 4).
 *
 * Application-layer invariants (NOT expressible as a DB FK, per
 * core-v2/prisma/schema.prisma's doc comment on this model):
 *  - coach must have CoachCourseCapability(courseKey) — checked here.
 *  - student's academicYearEnrollment must follow courseKey. The full rule
 *    (explicit StudentCourseEnrollment row OR a legally-derived CORE/TRACK
 *    module) needs a versioned curriculum catalog that does NOT exist yet in
 *    this foundation — only the schema/repositories/tests are built here,
 *    not the catalog. Until that catalog exists, this foundation requires an
 *    explicit StudentCourseEnrollment row for every assignment — the
 *    conservative subset of the real rule, never the unsafe direction (it
 *    never allows something the full rule would forbid, it only forbids a
 *    class of legitimate CORE/TRACK assignments the full rule would allow).
 *  - no two simultaneously-ACTIVE rows for the same (coach, enrollment,
 *    courseKey) triple — enforced by a real partial unique index
 *    (core-v2/prisma/migrations/0002_core_v2_sql_invariants), not just
 *    checked here: the check below is a fast, friendly pre-check only, the
 *    DB constraint is the actual race-safe source of truth.
 */
import type {
  CoachStudentCourseAssignment,
  Prisma,
  PrismaClient,
} from '@/core-v2/generated/client';

export class CoachLacksCapabilityError extends Error {}
export class StudentNotEnrolledInCourseError extends Error {}
export class DuplicateActiveAssignmentError extends Error {}

export interface CreateAssignmentInput {
  readonly coachId: string;
  readonly academicYearEnrollmentId: string;
  readonly courseKey: string;
  readonly assignedById?: string;
}

export async function createAssignment(
  client: PrismaClient,
  input: CreateAssignmentInput,
): Promise<CoachStudentCourseAssignment> {
  return client.$transaction(async (tx) => {
    const capability = await tx.coachCourseCapability.findUnique({
      where: { coachId_courseKey: { coachId: input.coachId, courseKey: input.courseKey } },
    });
    if (!capability) {
      throw new CoachLacksCapabilityError(
        `Coach ${input.coachId} has no CoachCourseCapability for courseKey "${input.courseKey}".`,
      );
    }

    const followsCourse = await tx.studentCourseEnrollment.findUnique({
      where: {
        academicYearEnrollmentId_courseKey: {
          academicYearEnrollmentId: input.academicYearEnrollmentId,
          courseKey: input.courseKey,
        },
      },
    });
    if (!followsCourse) {
      throw new StudentNotEnrolledInCourseError(
        `Enrollment ${input.academicYearEnrollmentId} has no StudentCourseEnrollment for ` +
          `courseKey "${input.courseKey}" (no curriculum catalog exists yet to derive a ` +
          `CORE/TRACK module instead — see this file's header comment).`,
      );
    }

    try {
      return await tx.coachStudentCourseAssignment.create({
        data: {
          coachId: input.coachId,
          academicYearEnrollmentId: input.academicYearEnrollmentId,
          courseKey: input.courseKey,
          assignedById: input.assignedById,
        },
      });
    } catch (error) {
      if (isActiveTripleUniqueViolation(error)) {
        throw new DuplicateActiveAssignmentError(
          `An ACTIVE assignment already exists for coach ${input.coachId}, enrollment ` +
            `${input.academicYearEnrollmentId}, courseKey "${input.courseKey}". End it first.`,
        );
      }
      throw error;
    }
  });
}

export async function endAssignment(
  client: Pick<PrismaClient, 'coachStudentCourseAssignment'>,
  assignmentId: string,
): Promise<CoachStudentCourseAssignment> {
  return client.coachStudentCourseAssignment.update({
    where: { id: assignmentId },
    data: { status: 'ENDED', endsAt: new Date() },
  });
}

const ACTIVE_TRIPLE_COLUMNS = ['coachId', 'academicYearEnrollmentId', 'courseKey'].sort();

/**
 * This partial unique index is raw SQL, unknown to Prisma's schema DSL — so
 * Prisma reports its violation via `meta.target` as the column list, not the
 * index name (verified empirically against Postgres 16: P2002 with
 * `meta.target: ["coachId","academicYearEnrollmentId","courseKey"]`, no
 * mention of `coach_student_course_assignments_active_triple_key` anywhere
 * in the error). Matching by exact column set is the reliable detection —
 * no other unique constraint on this table shares this column set.
 */
function isActiveTripleUniqueViolation(error: unknown): boolean {
  const prismaError = error as Prisma.PrismaClientKnownRequestError | undefined;
  if (!prismaError || prismaError.code !== 'P2002') return false;
  const target = prismaError.meta?.target;
  if (!Array.isArray(target)) return false;
  const sortedTarget = target.map(String).sort();
  return (
    sortedTarget.length === ACTIVE_TRIPLE_COLUMNS.length &&
    sortedTarget.every((col, i) => col === ACTIVE_TRIPLE_COLUMNS[i])
  );
}
