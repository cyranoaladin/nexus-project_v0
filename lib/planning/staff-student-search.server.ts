import 'server-only';

import { Prisma, PrismaClient } from '@prisma/client';

import { normalizeNullableUserEmail } from '@/lib/contact/user-email';
import { prisma } from '@/lib/prisma';
import {
  planningStudentSearchRequestSchema,
  planningStudentSearchSuccessSchema,
  type PlanningStudentSearchRequest,
  type PlanningStudentSearchSuccess,
} from '@/lib/quotes/staff-directory-search-contracts';

export type PlanningStudentSearchDatabase = Pick<PrismaClient, 'student'>;

function studentWhere(query: string): Prisma.StudentWhereInput {
  return {
    OR: [
      { user: { firstName: { contains: query, mode: 'insensitive' } } },
      { user: { lastName: { contains: query, mode: 'insensitive' } } },
      { user: { email: { contains: query, mode: 'insensitive' } } },
    ],
  };
}

function cleanText(value: string | null): string {
  return value?.trim() ?? '';
}

export async function searchPlanningStudents(
  input: PlanningStudentSearchRequest,
  database: PlanningStudentSearchDatabase = prisma,
): Promise<PlanningStudentSearchSuccess> {
  const request = planningStudentSearchRequestSchema.parse(input);
  const students = await database.student.findMany({
    where: studentWhere(request.query),
    select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (request.page - 1) * request.limit,
    take: request.limit,
  });

  return planningStudentSearchSuccessSchema.parse({
    items: students.map(({ user }) => ({
      userId: user.id,
      displayName: [cleanText(user.firstName), cleanText(user.lastName)].filter(Boolean).join(' ') || 'Élève',
      email: normalizeNullableUserEmail(user.email),
    })),
  });
}
