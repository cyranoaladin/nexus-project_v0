/**
 * Explicit SPECIALTY/OPTION course choices only — CORE/TRACK modules are
 * derived from gradeLevel × academicTrack × stmgPathway via a versioned
 * catalog and are never stored here (core-v2/prisma/schema.prisma comment on
 * StudentCourseEnrollment). No such catalog exists yet in this foundation —
 * see coach-student-course-assignment.ts for how that gap is handled today.
 */
import type {
  AcademicEnrollmentKind,
  PrismaClient,
  StudentCourseEnrollment,
} from '@/core-v2/generated/client';

export interface CreateCourseEnrollmentInput {
  readonly academicYearEnrollmentId: string;
  readonly courseKey: string;
  readonly kind: AcademicEnrollmentKind;
}

export async function createCourseEnrollment(
  client: Pick<PrismaClient, 'studentCourseEnrollment'>,
  input: CreateCourseEnrollmentInput,
): Promise<StudentCourseEnrollment> {
  return client.studentCourseEnrollment.create({ data: input });
}

export async function listCourseEnrollments(
  client: Pick<PrismaClient, 'studentCourseEnrollment'>,
  academicYearEnrollmentId: string,
): Promise<StudentCourseEnrollment[]> {
  return client.studentCourseEnrollment.findMany({ where: { academicYearEnrollmentId } });
}
