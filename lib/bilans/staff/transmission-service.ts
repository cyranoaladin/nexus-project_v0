import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Trace de transmission : « transmis au parent le [date] par WhatsApp ».
 *
 * La confirmation est posée par l'assistante APRÈS l'envoi effectif depuis
 * son WhatsApp. Sans cette trace, impossible de savoir qui a reçu son
 * bilan ; avec elle, la file « diffusés non transmis » se vide d'elle-même.
 * Append-only : une transmission ne se corrige pas, elle s'ajoute.
 */

export class ReportTransmissionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ReportTransmissionError';
  }
}

type TransmissionDatabase = Pick<PrismaClient, '$transaction' | 'reportArtifact' | 'reportShareLink' | 'reportTransmission'>;

export async function confirmWhatsAppTransmission(input: Readonly<{
  prisma?: TransmissionDatabase;
  reportArtifactId: string;
  confirmedById: string;
  now?: () => Date;
}>) {
  const database = input.prisma ?? prisma;
  const now = (input.now ?? (() => new Date()))();

  return database.$transaction(async (transaction) => {
    const artifact = await transaction.reportArtifact.findUnique({
      where: { id: input.reportArtifactId },
      select: {
        id: true,
        status: true,
        student: { select: { parent: { select: { userId: true } } } },
      },
    });
    // Aucun bilan transmis sans avoir été diffusé — garde absolue.
    if (artifact === null || artifact.status !== 'PUBLISHED') {
      throw new ReportTransmissionError('TRANSMISSION_REPORT_NOT_PUBLISHED');
    }
    const recipientUserId = artifact.student.parent?.userId;
    if (recipientUserId === undefined) throw new ReportTransmissionError('TRANSMISSION_RECIPIENT_MISSING');

    // La confirmation suppose des liens préparés et encore actifs : on ne
    // confirme pas la transmission d'un message qu'on n'a pas pu construire.
    const activeLinks = await transaction.reportShareLink.count({
      where: {
        reportArtifactId: artifact.id,
        recipientUserId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (activeLinks === 0) throw new ReportTransmissionError('TRANSMISSION_LINKS_REQUIRED');

    const transmission = await transaction.reportTransmission.create({
      data: {
        reportArtifactId: artifact.id,
        channel: 'WHATSAPP',
        recipientUserId,
        confirmedById: input.confirmedById,
        confirmedAt: now,
      },
      select: { id: true, confirmedAt: true },
    });
    return Object.freeze({ transmissionId: transmission.id, confirmedAt: transmission.confirmedAt });
  });
}
