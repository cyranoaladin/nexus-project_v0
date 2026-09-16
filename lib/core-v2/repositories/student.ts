/**
 * Student keeps only facts that never change per school year (ADR item 1).
 * Roster/grade/track live exclusively on StudentAcademicYearEnrollment — this
 * repository never reads or writes a legacy `grade` field (there is none on
 * this model) and never infers roster status from `createdAt`.
 */
import type {
  AcademicTrack,
  GradeLevel,
  PrismaClient,
  SchoolingStatus,
  Student,
  StmgPathway,
  StudentAcademicYearEnrollment,
  StudentAcademicYearEnrollmentStatus,
} from '@/core-v2/generated/client';

export interface CreateStudentInput {
  readonly householdId: string;
  readonly userId: string;
  readonly birthDate?: Date;
}

export async function createStudent(
  client: Pick<PrismaClient, 'student'>,
  input: CreateStudentInput,
): Promise<Student> {
  return client.student.create({ data: input });
}

export interface CreateAnnualEnrollmentInput {
  readonly studentId: string;
  readonly academicYearId: string;
  readonly gradeLevel: GradeLevel;
  readonly academicTrack?: AcademicTrack;
  readonly stmgPathway?: StmgPathway;
  readonly schoolingStatus?: SchoolingStatus;
  readonly school?: string;
}

/** Creation != approval: the row is created PENDING; see approveAnnualEnrollment. */
export async function createAnnualEnrollment(
  client: Pick<PrismaClient, 'studentAcademicYearEnrollment'>,
  input: CreateAnnualEnrollmentInput,
): Promise<StudentAcademicYearEnrollment> {
  return client.studentAcademicYearEnrollment.create({
    data: {
      studentId: input.studentId,
      academicYearId: input.academicYearId,
      gradeLevel: input.gradeLevel,
      academicTrack: input.academicTrack,
      stmgPathway: input.stmgPathway,
      schoolingStatus: input.schoolingStatus,
      school: input.school,
    },
  });
}

/**
 * Compare-and-set status transition. Returns the number of rows moved (0 or
 * 1): 0 means the row was not in `from` at the moment of the write — the
 * caller decides whether that is a conflict. Never an arbitrary status write.
 */
export async function transitionAnnualEnrollmentStatus(
  client: Pick<PrismaClient, 'studentAcademicYearEnrollment'>,
  enrollmentId: string,
  from: readonly StudentAcademicYearEnrollmentStatus[],
  to: StudentAcademicYearEnrollmentStatus,
  extra: { approvedById?: string; approvedAt?: Date } = {},
): Promise<number> {
  const result = await client.studentAcademicYearEnrollment.updateMany({
    where: { id: enrollmentId, status: { in: [...from] } },
    data: { status: to, ...extra },
  });
  return result.count;
}

/**
 * THE roster query for a school year — StudentAcademicYearEnrollment is the
 * sole authority (ADR item 1). Never derive membership from Student.createdAt
 * or any other recency signal.
 */
export async function getRosterForYear(
  client: Pick<PrismaClient, 'studentAcademicYearEnrollment'>,
  academicYearId: string,
  status: StudentAcademicYearEnrollmentStatus = 'ACTIVE',
): Promise<StudentAcademicYearEnrollment[]> {
  return client.studentAcademicYearEnrollment.findMany({
    where: { academicYearId, status },
  });
}
