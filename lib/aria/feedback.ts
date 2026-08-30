/**
 * ARIA Feedback Service — SSoT Canonique.
 *
 * Invariants :
 * - ARIA_FEEDBACK_SOURCES_OF_TRUTH=1 (AriaFeedback est la source canonique)
 * - FEEDBACK_PERSISTENCE_ERRORS_SWALLOWED=0
 * - Idempotence stricte (upsert par messageId)
 */

import { prisma } from '@/lib/prisma';
import { AriaError } from './errors';

export interface RecordFeedbackParams {
  readonly messageId: string;
  readonly studentId: string;
  readonly useful: boolean;
  readonly reason?: string | null;
}

export async function recordAriaFeedback(params: RecordFeedbackParams) {
  const { messageId, studentId, useful, reason } = params;

  // 1. Vérification de l'existence du message et de l'appartenance à l'étudiant
  const message = await prisma.ariaMessage.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });

  if (!message) {
    throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Message introuvable.');
  }

  if (message.conversation.studentId !== studentId) {
    throw new AriaError('NOT_ENTITLED', 403, 'Accès non autorisé à ce message.');
  }

  // 2. Persistance canonique dans AriaFeedback (Idempotent via findFirst + update/create)
  const existingFeedback = await prisma.ariaFeedback.findFirst({
    where: { messageId },
  });

  let savedFeedback;
  if (existingFeedback) {
    savedFeedback = await prisma.ariaFeedback.update({
      where: { id: existingFeedback.id },
      data: {
        useful,
        reason: reason || null,
      },
    });
  } else {
    savedFeedback = await prisma.ariaFeedback.create({
      data: {
        messageId,
        studentId,
        useful,
        reason: reason || null,
      },
    });
  }

  // 3. Synchronisation de rétro-compatibilité sur AriaMessage (miroir de lecture)
  await prisma.ariaMessage.update({
    where: { id: messageId },
    data: { feedback: useful },
  });

  return savedFeedback;
}
