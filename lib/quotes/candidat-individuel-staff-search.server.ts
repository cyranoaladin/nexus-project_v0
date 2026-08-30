import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { normalizeUserEmail } from '@/lib/contact/user-email';
import { prisma } from '@/lib/prisma';
import {
  candidatIndividuelLeadSearchRequestSchema,
  candidatIndividuelLeadSearchSuccessSchema,
  candidatIndividuelStudentSearchRequestSchema,
  candidatIndividuelStudentSearchSuccessSchema,
  candidatIndividuelStudentUnavailableReasonSchema,
  type CandidatIndividuelLeadSearchRequest,
  type CandidatIndividuelLeadSearchSuccess,
  type CandidatIndividuelStudentSearchRequest,
  type CandidatIndividuelStudentSearchSuccess,
} from '@/lib/quotes/candidat-individuel-search-contracts';
import { buildContactLeadSearchWhere } from '@/lib/quotes/persistence.server';

const studentSearchSelect = {
  id: true,
  gradeLevel: true,
  school: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      mergedIntoUserId: true,
    },
  },
  parent: {
    select: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          mergedIntoUserId: true,
        },
      },
    },
  },
} as const satisfies Prisma.StudentSelect;

const leadSearchSelect = {
  id: true,
  name: true,
  email: true,
} as const satisfies Prisma.ContactLeadSelect;

const normalizedEmailSchema = z.string().email().max(320);

type StudentSearchRow = Prisma.StudentGetPayload<{ select: typeof studentSearchSelect }>;
type CandidatIndividuelStudentUnavailableReason = z.infer<
  typeof candidatIndividuelStudentUnavailableReasonSchema
>;

export type CandidatIndividuelStaffSearchDatabase = Pick<
  PrismaClient,
  '$transaction' | 'student' | 'contactLead'
>;

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeNullableEmail(value: string | null | undefined): string | null {
  const text = nullableText(value);
  if (!text) return null;
  const normalized = normalizeUserEmail(text);
  return normalizedEmailSchema.safeParse(normalized).success ? normalized : null;
}

function displayName(firstName: string | null, lastName: string | null, fallback: string): string {
  return [nullableText(firstName), nullableText(lastName)].filter(Boolean).join(' ') || fallback;
}

function studentUnavailableReason(student: StudentSearchRow): CandidatIndividuelStudentUnavailableReason | null {
  if (nullableText(student.user.mergedIntoUserId)) return 'Compte élève fusionné';
  if (!student.parent) return 'Responsable absent';
  if (nullableText(student.parent.user.mergedIntoUserId)) return 'Compte responsable fusionné';
  if (!normalizeNullableEmail(student.parent.user.email)) return 'Adresse email du responsable manquante';
  if (!nullableText(student.parent.user.firstName) && !nullableText(student.parent.user.lastName)) {
    return 'Nom du responsable manquant';
  }
  return null;
}

function studentWhere(query: string): Prisma.StudentWhereInput {
  if (!query) return {};
  return {
    OR: [
      { user: { firstName: { contains: query, mode: 'insensitive' } } },
      { user: { lastName: { contains: query, mode: 'insensitive' } } },
      { user: { email: { contains: query, mode: 'insensitive' } } },
    ],
  };
}

export async function searchCandidatIndividuelStudents(
  input: CandidatIndividuelStudentSearchRequest,
  database: CandidatIndividuelStaffSearchDatabase = prisma,
): Promise<CandidatIndividuelStudentSearchSuccess> {
  const request = candidatIndividuelStudentSearchRequestSchema.parse(input);
  const where = studentWhere(request.query);
  const [students, total] = await database.$transaction(
    async (transaction) => Promise.all([
      transaction.student.findMany({
        where,
        select: studentSearchSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (request.page - 1) * request.limit,
        take: request.limit,
      }),
      transaction.student.count({ where }),
    ]),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  return candidatIndividuelStudentSearchSuccessSchema.parse({
    items: students.map((student) => {
      const unavailableReason = studentUnavailableReason(student);
      return {
        studentId: student.id,
        displayName: displayName(student.user.firstName, student.user.lastName, 'Élève'),
        email: normalizeNullableEmail(student.user.email),
        grade: nullableText(student.gradeLevel),
        school: nullableText(student.school),
        selectable: unavailableReason == null,
        unavailableReason,
      };
    }),
    pagination: {
      page: request.page,
      limit: request.limit,
      total,
      totalPages: Math.ceil(total / request.limit),
    },
  });
}

export async function searchCandidatIndividuelLeads(
  input: CandidatIndividuelLeadSearchRequest,
  database: CandidatIndividuelStaffSearchDatabase = prisma,
): Promise<CandidatIndividuelLeadSearchSuccess> {
  const request = candidatIndividuelLeadSearchRequestSchema.parse(input);
  const leads = await database.contactLead.findMany({
    where: buildContactLeadSearchWhere(request.query),
    select: leadSearchSelect,
    orderBy: { createdAt: 'desc' },
    take: request.limit,
  });

  return candidatIndividuelLeadSearchSuccessSchema.parse({
    items: leads.map((lead) => ({
      contactLeadId: lead.id,
      displayName: nullableText(lead.name) ?? 'Responsable',
      email: normalizeUserEmail(lead.email),
    })),
  });
}
