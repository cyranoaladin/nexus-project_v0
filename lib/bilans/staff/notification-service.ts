import type { PrismaClient } from '@prisma/client';

import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { prisma } from '@/lib/prisma';

import { frenchTypography } from '../render/typography';

/**
 * File de travail et synthèse de l'assistante.
 *
 * Le centre de notifications du dashboard lit `computeAssistantWorkQueue`
 * (requêtes vivantes, aucune écriture). L'e-mail de synthèse regroupe les
 * événements clés — jamais un e-mail par événement — et n'est envoyé que
 * s'il y a réellement quelque chose à traiter, au plus une fois par
 * intervalle. Il réutilise l'outbox chiffrée existante.
 */

export const ASSISTANT_DIGEST_NOTIFICATION_TYPE = 'BILAN_ASSISTANT_DIGEST';

/** Ancienneté (jours) au-delà de laquelle un foyer sans e-mail se relance. */
export function parentEmailReminderDays(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const value = Number(environment.BILAN_PARENT_EMAIL_REMINDER_DAYS ?? 3);
  return Number.isSafeInteger(value) && value >= 1 && value <= 60 ? value : 3;
}

/** Ancienneté (jours) au-delà de laquelle un bilan diffusé non transmis alerte. */
export function transmissionReminderDays(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const value = Number(environment.BILAN_TRANSMISSION_REMINDER_DAYS ?? 2);
  return Number.isSafeInteger(value) && value >= 1 && value <= 60 ? value : 2;
}

/** Intervalle minimal (heures) entre deux e-mails de synthèse. */
export function digestIntervalHours(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const value = Number(environment.BILAN_ASSISTANT_DIGEST_INTERVAL_HOURS ?? 24);
  return Number.isSafeInteger(value) && value >= 1 && value <= 168 ? value : 24;
}

type QueueDatabase = Pick<PrismaClient, 'reportRevision' | 'reportArtifact' | 'user' | 'parentProfile'>;

export type AssistantWorkQueue = Readonly<{
  pendingReview: number;
  correctionRequested: number;
  missingParentEmail: number;
  missingParentEmailStale: number;
  publishedNotTransmitted: number;
  publishedNotTransmittedStale: number;
  recentParentActivations: number;
}>;

export async function computeAssistantWorkQueue(
  dependencies: Readonly<{
    prisma?: QueueDatabase;
    now?: () => Date;
    environment?: Readonly<Record<string, string | undefined>>;
  }> = {},
): Promise<AssistantWorkQueue> {
  const database = dependencies.prisma ?? prisma;
  const now = (dependencies.now ?? (() => new Date()))();
  const emailStaleBefore = new Date(now.getTime() - parentEmailReminderDays(dependencies.environment) * 86_400_000);
  const transmissionStaleBefore = new Date(now.getTime() - transmissionReminderDays(dependencies.environment) * 86_400_000);
  const activationsSince = new Date(now.getTime() - 7 * 86_400_000);

  const missingEmailWhere = {
    status: 'PENDING_REVIEW' as const,
    reportArtifact: {
      status: 'PENDING_REVIEW' as const,
      student: { parent: { user: { email: null } } },
    },
  };
  const notTransmittedWhere = {
    status: 'PUBLISHED' as const,
    transmissions: { none: {} },
  };

  const [
    pendingReview,
    correctionRequested,
    missingParentEmail,
    missingParentEmailStale,
    publishedNotTransmitted,
    publishedNotTransmittedStale,
    recentParentActivations,
  ] = await Promise.all([
    database.reportRevision.count({
      where: { status: 'PENDING_REVIEW', reportArtifact: { status: 'PENDING_REVIEW' } },
    }),
    database.reportRevision.count({ where: { status: 'CORRECTION_REQUESTED' } }),
    database.reportRevision.count({ where: missingEmailWhere }),
    database.reportRevision.count({
      where: { ...missingEmailWhere, createdAt: { lt: emailStaleBefore } },
    }),
    database.reportArtifact.count({ where: notTransmittedWhere }),
    database.reportArtifact.count({
      where: { ...notTransmittedWhere, publishedAt: { lt: transmissionStaleBefore } },
    }),
    database.user.count({
      where: {
        role: 'PARENT',
        activatedAt: { gte: activationsSince },
        parentProfile: { children: { some: { canonicalAssessmentAttempts: { some: {} } } } },
      },
    }),
  ]);

  return Object.freeze({
    pendingReview,
    correctionRequested,
    missingParentEmail,
    missingParentEmailStale,
    publishedNotTransmitted,
    publishedNotTransmittedStale,
    recentParentActivations,
  });
}

function digestLines(queue: AssistantWorkQueue, environment?: Readonly<Record<string, string | undefined>>): readonly string[] {
  const lines: string[] = [];
  if (queue.pendingReview > 0) {
    lines.push(`${queue.pendingReview} bilan${queue.pendingReview > 1 ? 's' : ''} en attente de revue.`);
  }
  if (queue.correctionRequested > 0) {
    lines.push(`${queue.correctionRequested} bilan${queue.correctionRequested > 1 ? 's' : ''} en correction demandée.`);
  }
  if (queue.missingParentEmailStale > 0) {
    lines.push(`${queue.missingParentEmailStale} foyer${queue.missingParentEmailStale > 1 ? 's' : ''} sans e-mail parent depuis plus de ${parentEmailReminderDays(environment)} jours — une relance s'impose.`);
  }
  if (queue.publishedNotTransmittedStale > 0) {
    lines.push(`${queue.publishedNotTransmittedStale} bilan${queue.publishedNotTransmittedStale > 1 ? 's' : ''} diffusé${queue.publishedNotTransmittedStale > 1 ? 's' : ''} mais non transmis par WhatsApp depuis plus de ${transmissionReminderDays(environment)} jours.`);
  }
  if (queue.recentParentActivations > 0) {
    lines.push(`${queue.recentParentActivations} parent${queue.recentParentActivations > 1 ? 's ont' : ' a'} activé son espace ces sept derniers jours.`);
  }
  return Object.freeze(lines);
}

export function buildAssistantDigestEmail(
  queue: AssistantWorkQueue,
  dashboardUrl: string,
  environment?: Readonly<Record<string, string | undefined>>,
): Readonly<{ subject: string; text: string; html: string }> | null {
  const lines = digestLines(queue, environment);
  if (lines.length === 0) return null;
  const subject = frenchTypography('Bilans : votre synthèse Nexus Réussite');
  const text = frenchTypography([
    'Bonjour,',
    '',
    'Voici l\'état de la file des bilans :',
    '',
    ...lines.map((line) => `— ${line}`),
    '',
    `Tout se traite depuis votre tableau de bord : ${dashboardUrl}`,
    '',
    'L\'équipe Nexus Réussite',
  ].join('\n'));
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#071A3A;line-height:1.6;max-width:560px">',
    `<p>${frenchTypography('Bonjour,')}</p>`,
    `<p>${frenchTypography('Voici l\'état de la file des bilans :')}</p>`,
    `<ul>${lines.map((line) => `<li>${frenchTypography(line)}</li>`).join('')}</ul>`,
    `<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 18px;background:#071A3A;color:#FFFFFF;text-decoration:none;border-radius:6px">${frenchTypography('Ouvrir la file des bilans')}</a></p>`,
    `<p>${frenchTypography('L\'équipe Nexus Réussite')}</p>`,
    '</div>',
  ].join('');
  return Object.freeze({ subject, text, html });
}

type DigestDatabase = Pick<PrismaClient, '$transaction' | 'notification' | 'user' | 'reportRevision' | 'reportArtifact' | 'parentProfile' | 'jobOutbox'>;

/**
 * Envoie la synthèse aux assistantes si l'intervalle est écoulé ET qu'il y a
 * matière. Le dernier envoi est tracé par une notification in-app dédiée —
 * qui alimente en même temps le centre de notifications du dashboard.
 */
export async function maybeSendAssistantDigest(
  dependencies: Readonly<{
    prisma?: DigestDatabase;
    now?: () => Date;
    environment?: Readonly<Record<string, string | undefined>>;
    origin?: string;
  }> = {},
): Promise<Readonly<{ sent: boolean; reason: string }>> {
  const database = (dependencies.prisma ?? prisma) as DigestDatabase & QueueDatabase;
  const now = (dependencies.now ?? (() => new Date()))();
  const environment = dependencies.environment ?? process.env;
  const origin = dependencies.origin
    ?? environment.NEXTAUTH_URL?.replace(/\/$/, '')
    ?? 'https://nexusreussite.academy';

  const intervalMs = digestIntervalHours(environment) * 3_600_000;
  const lastDigest = await database.notification.findFirst({
    where: { type: ASSISTANT_DIGEST_NOTIFICATION_TYPE },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (lastDigest !== null && now.getTime() - lastDigest.createdAt.getTime() < intervalMs) {
    return Object.freeze({ sent: false, reason: 'INTERVAL_NOT_ELAPSED' });
  }

  const queue = await computeAssistantWorkQueue({ prisma: database, now: () => now, environment });
  const email = buildAssistantDigestEmail(queue, `${origin}/dashboard/assistante/bilans`, environment);
  if (email === null) return Object.freeze({ sent: false, reason: 'NOTHING_TO_REPORT' });

  const assistants = await database.user.findMany({
    where: { role: 'ASSISTANTE', email: { not: null } },
    select: { id: true, email: true },
  });
  if (assistants.length === 0) return Object.freeze({ sent: false, reason: 'NO_ASSISTANT' });

  await database.$transaction(async (transaction) => {
    for (const assistant of assistants) {
      if (assistant.email === null) continue;
      await enqueueEmailIntent(transaction, {
        aggregateId: assistant.id,
        messageType: 'TRANSACTIONAL_NOTIFICATION',
        dedupeKey: `bilan-digest:${assistant.id}:${now.toISOString().slice(0, 13)}`,
        to: assistant.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        now,
      });
      await transaction.notification.create({
        data: {
          userId: assistant.id,
          userRole: 'ASSISTANTE',
          type: ASSISTANT_DIGEST_NOTIFICATION_TYPE,
          title: 'Synthèse des bilans envoyée',
          message: frenchTypography('La synthèse de la file des bilans vient de vous être envoyée par e-mail.'),
          data: { queue },
        },
      });
    }
  });
  kickEmailOutboxDrain();
  return Object.freeze({ sent: true, reason: 'SENT' });
}
