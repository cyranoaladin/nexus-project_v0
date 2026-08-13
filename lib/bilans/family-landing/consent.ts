import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { withParentStudentConsentTransaction } from '@/lib/bilans/parent-student-consent';
import { resolveShareLinkContext } from '@/lib/bilans/staff/share-link-service';

/**
 * Recueil du consentement parental depuis la page d'arrivée d'un lien signé.
 *
 * Le défaut corrigé : le consentement ne se recueillait que depuis le
 * dashboard, auquel le parent n'a pas encore accès tant qu'il n'a pas
 * consenti — parcours circulaire. Ici, la preuve d'identité est le lien
 * signé lui-même : il porte le parent (destinataire) et l'élève (bilan
 * rattaché). On n'affaiblit pas la porte RGPD, on la déplace là où le
 * parent arrive réellement.
 *
 * La transition d'état reste EXACTEMENT celle du dashboard
 * (`ParentStudentConsentContext.verify`) : mêmes écritures, même
 * traçabilité (`consentedAt`, `verifiedAt`, propriété `parentUserId` /
 * `studentId` portée par la ligne), même revérification de propriété sous
 * verrou, même index unique « un seul lien actif ». Seule la provenance de
 * l'identité change : lien signé au lieu de session.
 */

export class FamilyConsentError extends Error {
  constructor(readonly code: 'INVALID_LINK') {
    super(code);
    this.name = 'FamilyConsentError';
  }
}

type FamilyConsentDatabase = Pick<
  PrismaClient,
  '$transaction' | 'reportShareLink' | 'reportArtifact' | 'reportRevision' | 'shareLinkAccess'
>;

type Dependencies = Readonly<{
  prisma?: FamilyConsentDatabase;
  now?: () => Date;
}>;

export type ConsentLinkState =
  | 'PENDING_PARENT_CONSENT'
  | 'VERIFIED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'MISSING';

/**
 * Vérifie le lien signé, en dérive le parent et l'élève, puis valide le
 * lien parent-élève (PENDING_PARENT_CONSENT → VERIFIED). Idempotent : un
 * lien déjà VERIFIED reste VERIFIED, sans erreur. Tout jeton non résoluble
 * (malformé, altéré, révoqué, expiré, bilan non diffusé, audience Nexus)
 * échoue uniformément en INVALID_LINK.
 */
export async function recordConsentFromShareToken(
  rawToken: string,
  dependencies: Dependencies = {},
): Promise<Readonly<{ state: 'VERIFIED'; studentId: string }>> {
  const database = dependencies.prisma ?? prisma;
  const nowFactory = dependencies.now ?? (() => new Date());

  const context = await resolveShareLinkContext(rawToken, { prisma: database, now: nowFactory });
  if (context === null) throw new FamilyConsentError('INVALID_LINK');

  await withParentStudentConsentTransaction(database, (consent) => consent.verify({
    parentUserId: context.parentUserId,
    studentId: context.studentId,
    now: nowFactory(),
  }));

  return Object.freeze({ state: 'VERIFIED', studentId: context.studentId });
}

/**
 * Lecture seule : l'état du consentement porté par le lien signé, sans
 * transition. Sert à la page d'arrivée pour afficher « déjà accordé » ou
 * proposer le recueil en une étape.
 */
export async function readConsentStateFromShareToken(
  rawToken: string,
  dependencies: Dependencies = {},
): Promise<Readonly<{ state: ConsentLinkState; studentId: string }>> {
  const database = dependencies.prisma ?? prisma;
  const nowFactory = dependencies.now ?? (() => new Date());

  const context = await resolveShareLinkContext(rawToken, { prisma: database, now: nowFactory });
  if (context === null) throw new FamilyConsentError('INVALID_LINK');

  const { state } = await withParentStudentConsentTransaction(database, (consent) => consent.getStatus({
    parentUserId: context.parentUserId,
    studentId: context.studentId,
    now: nowFactory(),
  }));
  return Object.freeze({ state, studentId: context.studentId });
}
