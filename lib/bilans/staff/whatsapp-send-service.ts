import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { buildParentWhatsAppUrl } from '@/lib/whatsapp';

import { bilanPackSubjectLabel } from '../catalog/subjects';
import { buildHumanRenderIdentity } from '../render/human-identity';
import { bilanPackLevelLabel } from '../render/stage-label';
import {
  createReportShareLinks,
  SHARE_LINK_DEFAULT_VALIDITY_DAYS,
} from './share-link-service';
import { buildBilanWhatsAppMessage } from './whatsapp-message';

/**
 * Prépare l'envoi WhatsApp assisté d'un bilan diffusé : liens signés neufs
 * (élève + parents, jamais Nexus), message français personnalisé, lien
 * wa.me vers le téléphone normalisé du parent. La plateforme prépare tout ;
 * l'envoi reste un geste humain de l'assistante, confirmé ensuite.
 */

export class WhatsAppSendError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'WhatsAppSendError';
  }
}

/** Durée de validité des liens, paramétrable sans redéploiement de code. */
export function shareLinkValidityDays(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = environment.BILAN_SHARE_LINK_VALIDITY_DAYS;
  if (raw === undefined || raw.trim() === '') return SHARE_LINK_DEFAULT_VALIDITY_DAYS;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 365) {
    throw new WhatsAppSendError('SHARE_LINK_VALIDITY_ENV_INVALID');
  }
  return value;
}

type SendDatabase = Pick<PrismaClient, '$transaction' | 'reportArtifact' | 'reportRevision' | 'reportShareLink' | 'shareLinkAccess'>;

export type PreparedWhatsAppSend = Readonly<{
  whatsappUrl: string;
  message: string;
  parentDisplayName: string;
  expiresAt: Date;
}>;

export async function prepareWhatsAppSend(input: Readonly<{
  prisma?: SendDatabase;
  actor: Readonly<{ userId: string; role: string }>;
  reportArtifactId: string;
  origin: string;
  now?: () => Date;
  environment?: Readonly<Record<string, string | undefined>>;
}>): Promise<PreparedWhatsAppSend> {
  if (input.actor.role !== 'ASSISTANTE' || !input.actor.userId.trim()) {
    throw new WhatsAppSendError('NOT_FOUND');
  }
  const database = input.prisma ?? prisma;

  const artifact = await database.reportArtifact.findUnique({
    where: { id: input.reportArtifactId },
    select: {
      id: true,
      status: true,
      student: {
        select: {
          user: { select: { firstName: true, lastName: true } },
          parent: {
            select: {
              user: {
                select: { id: true, firstName: true, lastName: true, phoneNormalized: true },
              },
            },
          },
        },
      },
      assessmentAttempt: { select: { assessmentPackId: true } },
      currentPublishedRevision: { select: { reportPackId: true, reportPackVersion: true } },
    },
  });
  // Garde : indisponible si le bilan n'est pas diffusé.
  if (artifact === null || artifact.status !== 'PUBLISHED' || artifact.currentPublishedRevision === null) {
    throw new WhatsAppSendError('WHATSAPP_REPORT_NOT_PUBLISHED');
  }
  const parentUser = artifact.student.parent?.user;
  if (parentUser === undefined) throw new WhatsAppSendError('WHATSAPP_PARENT_MISSING');
  // Garde : indisponible si le téléphone est absent.
  const phoneNormalized = parentUser.phoneNormalized?.trim();
  if (!phoneNormalized) throw new WhatsAppSendError('WHATSAPP_PARENT_PHONE_MISSING');

  const studentFirstName = artifact.student.user.firstName?.trim();
  if (!studentFirstName) throw new WhatsAppSendError('WHATSAPP_STUDENT_IDENTITY_MISSING');

  const { pack } = resolvePackLabels(artifact.currentPublishedRevision.reportPackId);

  const validityDays = shareLinkValidityDays(input.environment);
  const links = await createReportShareLinks({
    prisma: database,
    reportArtifactId: artifact.id,
    recipientUserId: parentUser.id,
    createdById: input.actor.userId,
    validityDays,
    now: input.now,
  });
  const parentLink = links.find(({ audience }) => audience === 'PARENTS');
  const studentLink = links.find(({ audience }) => audience === 'ELEVE');
  if (parentLink === undefined || studentLink === undefined) {
    throw new WhatsAppSendError('WHATSAPP_LINKS_UNAVAILABLE');
  }

  const parentDisplayName = buildHumanRenderIdentity({
    firstName: parentUser.firstName,
    lastName: parentUser.lastName,
  }).displayName;

  const message = buildBilanWhatsAppMessage({
    parentDisplayName,
    studentFirstName: buildHumanRenderIdentity({ firstName: studentFirstName, lastName: null }).displayName,
    subjectLabel: pack.subjectLabel,
    levelLabel: pack.levelLabel,
    parentLink: `${input.origin}/bilan/consultation/${parentLink.token}`,
    studentLink: `${input.origin}/bilan/consultation/${studentLink.token}`,
    validityDays,
  });

  return Object.freeze({
    whatsappUrl: buildParentWhatsAppUrl(phoneNormalized, message),
    message,
    parentDisplayName,
    expiresAt: parentLink.expiresAt,
  });
}

/**
 * Libellés depuis le slug de pack (`entree-<niveau>-<matière>-v1`). Le slug
 * est une provenance scellée : on n'en dérive que des libellés d'affichage.
 */
function resolvePackLabels(reportPackId: string): Readonly<{ pack: Readonly<{ subjectLabel: string; levelLabel: string }> }> {
  const match = /^entree-(quatrieme|troisieme|seconde|premiere|terminale)-([a-z-]+?)-v\d+$/.exec(reportPackId);
  if (match === null) {
    return Object.freeze({ pack: Object.freeze({ subjectLabel: 'la matière évaluée', levelLabel: 'la classe visée' }) });
  }
  const LEVELS: Record<string, string> = {
    quatrieme: 'QUATRIEME', troisieme: 'TROISIEME', seconde: 'SECONDE', premiere: 'PREMIERE', terminale: 'TERMINALE',
  };
  const SUBJECTS: Record<string, string> = {
    maths: 'MATHS', 'maths-expertes': 'MATHS_EXPERTES', nsi: 'NSI', francais: 'FRANCAIS',
    'physique-chimie': 'PHYSIQUE_CHIMIE', svt: 'SVT', philosophie: 'PHILOSOPHIE',
  };
  const level = LEVELS[match[1]];
  const subject = SUBJECTS[match[2]];
  if (level === undefined || subject === undefined) {
    return Object.freeze({ pack: Object.freeze({ subjectLabel: 'la matière évaluée', levelLabel: 'la classe visée' }) });
  }
  return Object.freeze({
    pack: Object.freeze({
      subjectLabel: bilanPackSubjectLabel(subject),
      levelLabel: bilanPackLevelLabel(level),
    }),
  });
}

export type PreparedUpdateInfoMessage = Readonly<{
  whatsappUrl: string;
  message: string;
}>;

/**
 * Message d'information après régénération d'un bilan déjà transmis — cas B,
 * option 3. NE TOUCHE PAS AUX LIENS (aucune révocation, aucune réémission :
 * un lien enregistré par le parent ne meurt jamais) ; prépare seulement le
 * wa.me courtois que l'assistante enverra elle-même. Exigences : bilan
 * PUBLIÉ en génération > 1, téléphone parent présent, et une transmission
 * WhatsApp CONFIRMÉE antérieure (sinon la mention sur la page suffit —
 * décision responsable du 14/08/2026).
 */
export async function prepareUpdateInfoMessage(input: Readonly<{
  prisma?: SendDatabase;
  actor: Readonly<{ userId: string; role: string }>;
  reportArtifactId: string;
}>): Promise<PreparedUpdateInfoMessage> {
  if (input.actor.role !== 'ASSISTANTE' || !input.actor.userId.trim()) {
    throw new WhatsAppSendError('WHATSAPP_FORBIDDEN');
  }
  const database = input.prisma ?? prisma;
  const artifact = await database.reportArtifact.findUnique({
    where: { id: input.reportArtifactId },
    select: {
      status: true,
      currentPublishedRevision: { select: { generation: true, materialization: { select: { materializedAt: true } } } },
      transmissions: {
        where: { channel: 'WHATSAPP' },
        orderBy: { confirmedAt: 'desc' },
        take: 1,
        select: { confirmedAt: true },
      },
      student: {
        select: {
          user: { select: { firstName: true } },
          parent: { select: { user: { select: { firstName: true, lastName: true, phoneNormalized: true } } } },
        },
      },
    },
  });
  if (artifact === null || artifact.status !== 'PUBLISHED') {
    throw new WhatsAppSendError('WHATSAPP_REPORT_NOT_PUBLISHED');
  }
  const current = artifact.currentPublishedRevision;
  if (current === null || current.generation <= 1 || current.materialization === null) {
    throw new WhatsAppSendError('WHATSAPP_UPDATE_INFO_NOT_A_REGENERATION');
  }
  if (artifact.transmissions.length === 0) {
    // Jamais transmis-confirmé : la mention sur la page d'arrivée suffit.
    throw new WhatsAppSendError('WHATSAPP_UPDATE_INFO_NO_PRIOR_TRANSMISSION');
  }
  const parentUser = artifact.student.parent?.user;
  const phoneNormalized = parentUser?.phoneNormalized?.trim();
  if (!phoneNormalized) throw new WhatsAppSendError('WHATSAPP_PARENT_PHONE_MISSING');

  const parentDisplayName = [parentUser.firstName, parentUser.lastName].filter(Boolean).join(' ') || 'Madame, Monsieur';
  const { buildBilanUpdateWhatsAppMessage } = await import('./whatsapp-message');
  const message = buildBilanUpdateWhatsAppMessage({
    parentDisplayName,
    studentFirstName: artifact.student.user.firstName?.trim() || 'votre enfant',
    updatedAtLabel: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(current.materialization.materializedAt),
  });
  return Object.freeze({
    whatsappUrl: buildParentWhatsAppUrl(phoneNormalized, message),
    message,
  });
}
