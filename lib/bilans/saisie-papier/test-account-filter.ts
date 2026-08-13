import type { Prisma } from '@prisma/client';
import { normalizeUserEmail } from '@/lib/contact/user-email';

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
  const normalized = normalizeUserEmail(email);
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
 * « Cet utilisateur n'est PAS un compte de test masquable » — formulée de façon
 * NULL-safe.
 *
 * Défaut corrigé : `{ NOT: { parent: { is: { user: { is: excludedUserWhere } } } } }`
 * excluait un foyer dont le PARENT n'a pas d'e-mail (`email = NULL`). En SQL,
 * `NOT (email LIKE '%…%')` vaut NULL quand `email` est NULL, et une ligne dont
 * la condition WHERE est NULL est écartée. Résultat : un foyer créé par la
 * saisie papier SANS e-mail (flux différé légitime) devenait invisible sur
 * l'écran assistante — l'élève tout juste saisi restait introuvable.
 *
 * Un e-mail absent n'est jamais un compte de test : on le rend explicitement
 * visible. Pour un e-mail présent, on garde l'exclusion des motifs de test.
 */
const notExcludedUserWhere: Prisma.UserWhereInput = {
  OR: [
    { email: null },
    { NOT: excludedUserWhere },
  ],
};

/**
 * Database-side privacy guard. The projection is filtered again with
 * `isVisiblePaperEntryHousehold` because this staff screen must fail closed if
 * a future query refactor accidentally drops or weakens a relation condition.
 */
export function paperEntryVisibleStudentWhere(): Prisma.StudentWhereInput {
  return {
    AND: [
      { user: { is: notExcludedUserWhere } },
      { parent: { is: { user: { is: notExcludedUserWhere } } } },
    ],
  };
}
