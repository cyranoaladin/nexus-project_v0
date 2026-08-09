import type { Prisma } from '@prisma/client';

const EXACT_EXCLUDED_EMAILS = new Set([
  'parent-technique@nexusreussite.academy',
]);

const EXCLUDED_EMAIL_FRAGMENTS = [
  '@example.test',
  '@invalid.residual',
  'smoke',
  'do_not_use',
  'residual',
] as const;

export function isExcludedPaperEntryAccountEmail(email: string | null): boolean {
  if (email === null) return false;
  const normalized = email.trim().toLowerCase();
  return EXACT_EXCLUDED_EMAILS.has(normalized)
    || EXCLUDED_EMAIL_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

export function isVisiblePaperEntryHousehold(identity: Readonly<{
  studentEmail: string | null;
  parentEmail: string | null;
}>): boolean {
  return !isExcludedPaperEntryAccountEmail(identity.studentEmail)
    && !isExcludedPaperEntryAccountEmail(identity.parentEmail);
}

const excludedUserWhere: Prisma.UserWhereInput = {
  OR: [
    { email: { contains: '@example.test', mode: 'insensitive' } },
    { email: { contains: '@invalid.residual', mode: 'insensitive' } },
    { email: { contains: 'smoke', mode: 'insensitive' } },
    { email: { contains: 'DO_NOT_USE', mode: 'insensitive' } },
    { email: { contains: 'residual', mode: 'insensitive' } },
    { email: { equals: 'parent-technique@nexusreussite.academy', mode: 'insensitive' } },
  ],
};

/**
 * Database-side privacy guard. The projection is filtered again with
 * `isVisiblePaperEntryHousehold` because this staff screen must fail closed if
 * a future query refactor accidentally drops or weakens a relation condition.
 */
export function paperEntryVisibleStudentWhere(): Prisma.StudentWhereInput {
  return {
    NOT: [
      { user: { is: excludedUserWhere } },
      { parent: { is: { user: { is: excludedUserWhere } } } },
    ],
  };
}
