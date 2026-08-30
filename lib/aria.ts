/**
 * ARIA Conversation Service — Façade Isomorphe.
 *
 * Invariants stricts :
 * - ARIA_GENERATION_PIPELINES=1 (délégation vers executeAriaConversationJson / streamAriaConversation)
 * - HARDCODED_TERMINALE_LEGACY_CALLS=0 (aucun gradeLevel hardcodé)
 * - LEGACY_SUBJECT_NULL_TO_MATHS=0
 * - ARIA_FEEDBACK_SOURCES_OF_TRUTH=1
 */

import { Subject, GradeLevel } from '@/types/enums';
import { prisma } from './prisma';
import { streamAriaConversation, executeAriaConversationJson } from '@/lib/aria/orchestration';
import { buildAriaRetrievalPlan, executeAriaRetrieval } from '@/lib/aria/rag';
import { mapLegacySubjectToCourseKey } from '@/lib/aria/legacy-adapter';
import { recordAriaFeedback as canonicalRecordFeedback } from '@/lib/aria/feedback';
import { AriaError } from '@/lib/aria/errors';

/**
 * Recherche de connaissances RAG sans avaler les erreurs silencieusement.
 * Requiert un GradeLevel explicite (zéro default).
 */
export async function searchKnowledgeBase(
  query: string,
  subject: Subject,
  gradeLevel: GradeLevel,
  limit: number = 3
) {
  const courseKey = mapLegacySubjectToCourseKey(subject, gradeLevel);
  const plan = buildAriaRetrievalPlan(courseKey);
  if (!plan) {
    throw new AriaError('RAG_UNAVAILABLE', 503, `Aucun plan de recherche RAG disponible pour le cours ${courseKey}`);
  }
  const result = await executeAriaRetrieval(plan, query, { k: limit });
  if (result.status === 'RUNTIME_UNAVAILABLE') {
    throw new AriaError('RAG_UNAVAILABLE', 503, `RAG indisponible : ${result.error}`);
  }
  return result.status === 'SUCCESS' ? result.hits : [];
}

/**
 * Génération d'une réponse ARIA (mode synchrone / test / non-streaming).
 * Délègue au pipeline canonique unique executeAriaConversationJson.
 */
export async function generateAriaResponse(
  studentId: string,
  subject: Subject,
  message: string,
  _conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      academicEnrollments: true,
      subscriptions: { where: { status: 'ACTIVE' }, take: 1 },
    },
  });

  if (!student) {
    throw new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable pour la résolution de matière.');
  }

  const courseKey = mapLegacySubjectToCourseKey(subject, student.gradeLevel);

  const result = await executeAriaConversationJson({
    studentId,
    courseKey,
    message,
    studentOverride: student,
  });

  return result.fullText;
}

/**
 * Sauvegarde d'une conversation ARIA (alignée sur les cours canoniques).
 */
export async function saveAriaConversation(
  studentId: string,
  subject: Subject,
  userMessage: string,
  ariaResponse: string,
  conversationId?: string
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { academicEnrollments: true },
  });

  if (!student) {
    throw new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable.');
  }

  const courseKey = mapLegacySubjectToCourseKey(subject, student.gradeLevel);

  let conversation;

  if (conversationId) {
    conversation = (await prisma.ariaConversation.findFirst({
      where: { id: conversationId },
    })) ?? (await prisma.ariaConversation.findUnique({
      where: { id: conversationId },
    }));

    if (!conversation) {
      throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation introuvable (ARIA_CONVERSATION_NOT_FOUND).');
    }
  } else {
    conversation = await prisma.ariaConversation.create({
      data: {
        studentId,
        subject,
        courseKey,
        title: userMessage.slice(0, 45) + (userMessage.length > 45 ? '...' : ''),
      },
    });
  }

  const userMsgRecord = await prisma.ariaMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: userMessage,
      status: 'COMPLETED',
    },
  });

  const assistantMsgRecord = await prisma.ariaMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: ariaResponse,
      status: 'COMPLETED',
    },
  });

  return {
    conversation,
    userMessage: userMsgRecord,
    assistantMessage: assistantMsgRecord,
    ariaMessage: assistantMsgRecord,
  };
}

/**
 * Enregistrement du feedback délégué vers la source de vérité canonique.
 */
export async function recordAriaFeedback(messageId: string, feedback: boolean, reason?: string) {
  const message = await prisma.ariaMessage.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });

  if (!message) {
    throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Message introuvable.');
  }

  await canonicalRecordFeedback({
    messageId,
    studentId: message.conversation.studentId,
    useful: feedback,
    reason,
  });

  return await prisma.ariaMessage.update({
    where: { id: messageId },
    data: { feedback },
  });
}

/**
 * Génération de stream ARIA (délégation directe vers le pipeline canonique).
 */
export async function generateAriaStream(
  studentId: string,
  subject: Subject,
  message: string,
  _conversationHistory: Array<{ role: string; content: string }> = [],
  onCompleteOrSignal?: ((full: string) => Promise<void> | void) | AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const onComplete = typeof onCompleteOrSignal === 'function' ? onCompleteOrSignal : undefined;
  const signal = onCompleteOrSignal instanceof AbortSignal ? onCompleteOrSignal : undefined;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      academicEnrollments: true,
      subscriptions: { where: { status: 'ACTIVE' }, take: 1 },
    },
  });

  if (!student) {
    throw new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable pour la résolution de matière.');
  }

  const courseKey = mapLegacySubjectToCourseKey(subject, student.gradeLevel);

  return await streamAriaConversation({
    studentId,
    courseKey,
    message,
    signal,
    onComplete,
  });
}

// ─── Ré-export des types et fonctions canoniques ────────────────────────────
export { streamAriaConversation, executeAriaConversationJson } from '@/lib/aria/orchestration';
