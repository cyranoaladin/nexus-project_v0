import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Liens de consultation signés des bilans diffusés — voie B WhatsApp.
 *
 * Le jeton remis au parent est `<id>.<secret>` : identifiant public du lien
 * plus secret de 256 bits. Seule l'empreinte SHA-256 du secret est stockée ;
 * la vérification est en temps constant. Un lien est donc impossible à
 * deviner, il expire, il se révoque, et chaque consultation est journalisée
 * (date seule — aucune donnée identifiante superflue).
 *
 * Le bilan NEXUS est un document interne : l'interdiction est portée par le
 * type, revérifiée ici, et verrouillée en base par une contrainte CHECK.
 */

export const SHARE_LINK_SERVICE_VERSION = 'report-share-links.v1' as const;

/** Durée de validité par défaut — décision du responsable : 30 jours. */
export const SHARE_LINK_DEFAULT_VALIDITY_DAYS = 30;

export type ShareableAudience = 'ELEVE' | 'PARENTS';

const SHAREABLE_AUDIENCES: readonly ShareableAudience[] = ['ELEVE', 'PARENTS'];

type ShareDatabase = Pick<PrismaClient, '$transaction' | 'reportShareLink' | 'reportArtifact' | 'shareLinkAccess'>;

export class ReportShareLinkError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ReportShareLinkError';
  }
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

function constantTimeMatches(expectedHash: string, secret: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(hashSecret(secret), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type CreatedShareLink = Readonly<{
  audience: ShareableAudience;
  /** Jeton complet, à insérer dans le message — jamais persisté. */
  token: string;
  expiresAt: Date;
}>;

type CreateInput = Readonly<{
  prisma?: ShareDatabase;
  reportArtifactId: string;
  recipientUserId: string;
  createdById: string;
  validityDays?: number;
  now?: () => Date;
}>;

function assertValidityDays(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 365) {
    throw new ReportShareLinkError('SHARE_LINK_VALIDITY_INVALID');
  }
  return value;
}

/**
 * Crée (ou renouvelle) les deux liens publics d'un bilan DIFFUSÉ, pour son
 * destinataire. Les liens précédents du même artefact et du même destinataire
 * sont révoqués : un renvoi WhatsApp repart toujours sur des jetons neufs.
 */
export async function createReportShareLinks(input: CreateInput): Promise<readonly CreatedShareLink[]> {
  const database = input.prisma ?? prisma;
  const now = (input.now ?? (() => new Date()))();
  const validityDays = assertValidityDays(input.validityDays ?? SHARE_LINK_DEFAULT_VALIDITY_DAYS);
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

  return database.$transaction(async (transaction) => {
    const artifact = await transaction.reportArtifact.findUnique({
      where: { id: input.reportArtifactId },
      select: {
        id: true,
        status: true,
        currentPublishedRevisionId: true,
        student: { select: { parent: { select: { userId: true } } } },
      },
    });
    // Garde absolue : aucun lien ne peut exister pour un bilan non diffusé.
    if (artifact === null || artifact.status !== 'PUBLISHED' || artifact.currentPublishedRevisionId === null) {
      throw new ReportShareLinkError('SHARE_LINK_REPORT_NOT_PUBLISHED');
    }
    if (artifact.student.parent?.userId !== input.recipientUserId) {
      throw new ReportShareLinkError('SHARE_LINK_RECIPIENT_MISMATCH');
    }

    await transaction.reportShareLink.updateMany({
      where: {
        reportArtifactId: artifact.id,
        recipientUserId: input.recipientUserId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    const created: CreatedShareLink[] = [];
    for (const audience of SHAREABLE_AUDIENCES) {
      const secret = randomBytes(32).toString('base64url');
      const link = await transaction.reportShareLink.create({
        data: {
          reportArtifactId: artifact.id,
          audience,
          recipientUserId: input.recipientUserId,
          tokenHash: hashSecret(secret),
          expiresAt,
          createdById: input.createdById,
        },
        select: { id: true },
      });
      created.push(Object.freeze({ audience, token: `${link.id}.${secret}`, expiresAt }));
    }
    return Object.freeze(created);
  });
}

export type VerifiedShareLink = Readonly<{
  audience: ShareableAudience;
  html: string;
  studentFirstName: string | null;
}>;

/**
 * Vérifie un jeton et sert le document. Toute anomalie — jeton malformé,
 * inconnu, altéré, révoqué, expiré, bilan retiré de la diffusion — répond de
 * la même façon : introuvable. La consultation réussie est journalisée.
 */
export async function verifyAndConsumeShareToken(
  rawToken: string,
  dependencies: Readonly<{ prisma?: ShareDatabase; now?: () => Date }> = {},
): Promise<VerifiedShareLink | null> {
  const database = dependencies.prisma ?? prisma;
  const now = (dependencies.now ?? (() => new Date()))();

  const separator = rawToken.indexOf('.');
  if (separator <= 0 || separator === rawToken.length - 1 || rawToken.length > 256) return null;
  const linkId = rawToken.slice(0, separator);
  const secret = rawToken.slice(separator + 1);

  const link = await database.reportShareLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      audience: true,
      tokenHash: true,
      expiresAt: true,
      revokedAt: true,
      reportArtifact: {
        select: {
          status: true,
          student: { select: { user: { select: { firstName: true } } } },
          currentPublishedRevision: {
            select: {
              materialization: {
                select: {
                  audienceArtifacts: { select: { audience: true, html: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (link === null) return null;
  if (!constantTimeMatches(link.tokenHash, secret)) return null;
  if (link.revokedAt !== null) return null;
  if (link.expiresAt.getTime() <= now.getTime()) return null;
  if (link.reportArtifact.status !== 'PUBLISHED') return null;
  // Défense en profondeur : même si une ligne NEXUS existait, elle ne sortirait pas.
  if (link.audience !== 'ELEVE' && link.audience !== 'PARENTS') return null;

  const artifact = link.reportArtifact.currentPublishedRevision?.materialization?.audienceArtifacts
    .find(({ audience }) => audience === link.audience);
  if (artifact === undefined) return null;

  await database.shareLinkAccess.create({ data: { shareLinkId: link.id } });

  return Object.freeze({
    audience: link.audience,
    html: artifact.html,
    studentFirstName: link.reportArtifact.student.user.firstName,
  });
}

export async function revokeReportShareLinks(input: Readonly<{
  prisma?: ShareDatabase;
  reportArtifactId: string;
  now?: () => Date;
}>): Promise<number> {
  const database = input.prisma ?? prisma;
  const now = (input.now ?? (() => new Date()))();
  const revoked = await database.reportShareLink.updateMany({
    where: { reportArtifactId: input.reportArtifactId, revokedAt: null },
    data: { revokedAt: now },
  });
  return revoked.count;
}
