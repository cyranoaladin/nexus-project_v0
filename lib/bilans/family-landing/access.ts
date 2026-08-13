import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { createParentActivationToken, buildParentActivationEmail } from '@/lib/auth/parent-activation';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { resolveShareLinkContext } from '@/lib/bilans/staff/share-link-service';

import { FamilyConsentError } from './consent';

/**
 * Création de l'accès parent depuis la page d'arrivée d'un lien signé.
 *
 * Réutilise à l'identique l'infrastructure d'activation existante (jeton
 * haché 72 h, e-mail d'activation, outbox chiffrée, mot de passe choisi par
 * le parent via /auth/activate) — même mécanique que la saisie papier
 * (lib/bilans/saisie-papier/famille.ts), avec pour seule différence la
 * provenance de l'identité : le lien signé au lieu d'une session assistante.
 *
 * L'e-mail est FACULTATIF côté parcours : un parent peut lire son bilan et
 * repartir sans créer d'accès. Cette fonction n'est appelée que s'il en
 * fournit un.
 */

export class FamilyAccessError extends Error {
  constructor(readonly code:
    | 'INVALID_LINK'
    | 'PARENT_EMAIL_ALREADY_SET'
    | 'EMAIL_ALREADY_USED'
    | 'EMAIL_INVALID') {
    super(code);
    this.name = 'FamilyAccessError';
  }
}

type FamilyAccessDatabase = Pick<
  PrismaClient,
  '$transaction' | 'reportShareLink' | 'reportArtifact' | 'reportRevision' | 'shareLinkAccess' | 'user' | 'jobOutbox'
>;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FamilyAccessState = Readonly<{
  /** true si le compte parent a déjà une adresse (activation déjà engagée ou compte actif). */
  parentHasEmail: boolean;
  parentActivated: boolean;
}>;

/** État du compte parent porté par le lien — pilote l'affichage du champ e-mail. */
export async function readParentAccessState(
  rawToken: string,
  dependencies: Readonly<{ prisma?: FamilyAccessDatabase; now?: () => Date }> = {},
): Promise<FamilyAccessState> {
  const database = dependencies.prisma ?? prisma;
  const context = await resolveShareLinkContext(rawToken, {
    prisma: database,
    now: dependencies.now,
  });
  if (context === null) throw new FamilyConsentError('INVALID_LINK');

  const parent = await database.user.findUnique({
    where: { id: context.parentUserId },
    select: { email: true, activatedAt: true },
  });
  return Object.freeze({
    parentHasEmail: parent?.email !== null && parent?.email !== undefined,
    parentActivated: parent?.activatedAt !== null && parent?.activatedAt !== undefined,
  });
}

/**
 * Rattache l'adresse fournie au compte parent (créé sans e-mail à la saisie
 * papier) et envoie l'e-mail d'activation. Idempotent sur la même adresse ;
 * refuse d'écraser une adresse déjà posée (l'assistante reste le canal de
 * correction). L'unicité d'adresse est portée par la contrainte de la base.
 */
export async function attachParentEmailFromShareToken(
  rawToken: string,
  rawEmail: string,
  dependencies: Readonly<{ prisma?: FamilyAccessDatabase; now?: () => Date }> = {},
): Promise<Readonly<{ activationQueued: boolean }>> {
  const database = dependencies.prisma ?? prisma;
  const now = (dependencies.now ?? (() => new Date()))();

  const email = normalizeUserEmail(rawEmail);
  if (!EMAIL_SHAPE.test(email)) throw new FamilyAccessError('EMAIL_INVALID');

  const context = await resolveShareLinkContext(rawToken, {
    prisma: database,
    now: dependencies.now,
  });
  if (context === null) throw new FamilyAccessError('INVALID_LINK');

  try {
    return await database.$transaction(async (transaction) => {
      const parent = await transaction.user.findUnique({
        where: { id: context.parentUserId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (parent === null) throw new FamilyAccessError('INVALID_LINK');
      if (parent.email !== null) {
        if (normalizeUserEmail(parent.email) === email) {
          return Object.freeze({ activationQueued: false });
        }
        throw new FamilyAccessError('PARENT_EMAIL_ALREADY_SET');
      }

      const activation = createParentActivationToken(now);
      await transaction.user.update({
        where: { id: parent.id },
        data: {
          email,
          activationToken: activation.tokenHash,
          activationExpiry: activation.expiresAt,
          sessionVersion: { increment: 1 },
        },
      });

      const parentName = [parent.firstName, parent.lastName].filter(Boolean).join(' ') || 'Parent';
      const message = buildParentActivationEmail({
        parentName,
        childFirstName: context.studentFirstName ?? 'votre enfant',
        rawToken: activation.rawToken,
      });
      await enqueueEmailIntent(transaction, {
        aggregateId: parent.id,
        messageType: 'PARENT_ACTIVATION',
        dedupeKey: activation.tokenHash,
        to: email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return Object.freeze({ activationQueued: true });
    });
  } catch (error) {
    if (
      typeof error === 'object' && error !== null
      && 'code' in error && (error as { code: unknown }).code === 'P2002'
    ) {
      throw new FamilyAccessError('EMAIL_ALREADY_USED');
    }
    throw error;
  }
}
