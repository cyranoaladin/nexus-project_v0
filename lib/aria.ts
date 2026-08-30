/**
 * ARIA Conversation Service — Unifié vers l'architecture canonique.
 *
 * Invariant : ARIA_GENERATION_PIPELINES=1.
 * Délégué vers les services d'orchestration et le gateway de modèle unique.
 */

import { Subject } from '@/types/enums';
import { prisma } from './prisma';
import { streamAriaConversation } from '@/lib/aria/orchestration';
import { buildAriaPromptEnvelope } from '@/lib/aria/prompt';
import { callChatCompletion } from '@/lib/aria/gateway';
import { buildAriaRetrievalPlan, executeAriaRetrieval } from '@/lib/aria/rag';
import { mapLegacySubjectToCourseKey } from '@/lib/aria/legacy-adapter';
import type { AriaCitationHit } from '@/lib/aria/contracts';

/**
 * Recherche de connaissances RAG sans avaler les erreurs silencieusement.
 */
export async function searchKnowledgeBase(query: string, subject: Subject, limit: number = 3) {
  const courseKey = mapLegacySubjectToCourseKey(subject, 'TERMINALE');
  const plan = buildAriaRetrievalPlan(courseKey);
  if (!plan) {
    throw new Error(`Aucun plan de recherche RAG disponible pour le cours ${courseKey}`);
  }
  const result = await executeAriaRetrieval(plan, query, { k: limit });
  if (result.status === 'RUNTIME_UNAVAILABLE') {
    throw new Error(`RAG indisponible : ${result.error}`);
  }
  return result.status === 'SUCCESS' ? result.hits : [];
}

/**
 * Génération d'une réponse ARIA (mode synchrone / test / non-streaming).
 * Utilise strictement le gateway centralisé sans instanciation directe d'OpenAI.
 */
export async function generateAriaResponse(
  _studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  const courseKey = mapLegacySubjectToCourseKey(subject, 'TERMINALE');
  const plan = buildAriaRetrievalPlan(courseKey);
  let citations: AriaCitationHit[] = [];

  if (plan) {
    try {
      const ragResult = await executeAriaRetrieval(plan, message);
      if (ragResult.status === 'SUCCESS') {
        citations = [...ragResult.hits];
      }
    } catch {
      // Si la recherche RAG échoue, poursuite de la réponse par le modèle pur
    }
  }

  const promptMessages = buildAriaPromptEnvelope({
    courseKey,
    citations,
    conversationHistory,
    userMessage: message,
  });

  return await callChatCompletion(promptMessages);
}

/**
 * Sauvegarde d'une conversation ARIA.
 */
export async function saveAriaConversation(
  studentId: string,
  subject: Subject,
  userMessage: string,
  ariaResponse: string,
  conversationId?: string
) {
  let conversation;

  if (conversationId) {
    conversation = await prisma.ariaConversation.findFirst({
      where: {
        id: conversationId,
        studentId,
      },
    });

    if (!conversation) {
      throw new Error('ARIA_CONVERSATION_NOT_FOUND');
    }
  }

  if (!conversation) {
    conversation = await prisma.ariaConversation.create({
      data: {
        studentId,
        subject,
        courseKey: mapLegacySubjectToCourseKey(subject, 'TERMINALE'),
        title: userMessage.substring(0, 50) + '...',
      },
    });
  }

  // Sauvegarde du message utilisateur
  await prisma.ariaMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: userMessage,
      status: 'COMPLETED',
    },
  });

  // Sauvegarde de la réponse ARIA
  const ariaMessage = await prisma.ariaMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: ariaResponse,
      status: 'COMPLETED',
    },
  });

  return { conversation, ariaMessage };
}

/**
 * Streaming ARIA unifié délégué directement au moteur d'orchestration.
 */
export async function generateAriaStream(
  studentId: string,
  subject: Subject,
  message: string,
  _conversationHistory: Array<{ role: string; content: string }> = [],
  onComplete?: (fullResponse: string) => Promise<void>
): Promise<ReadableStream<Uint8Array>> {
  const courseKey = mapLegacySubjectToCourseKey(subject, 'TERMINALE');
  const baseStream = await streamAriaConversation({
    studentId,
    courseKey,
    message,
  });

  if (!onComplete) {
    return baseStream;
  }

  const reader = baseStream.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        if (onComplete) {
          await onComplete(fullText).catch(() => {});
        }
        controller.close();
        return;
      }
      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split('\n\n');
      for (const line of lines) {
        if (line.startsWith('event: delta\ndata: ')) {
          try {
            const data = JSON.parse(line.replace('event: delta\ndata: ', ''));
            if (data.text) fullText += data.text;
          } catch {}
        }
      }
      controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

/**
 * Enregistrement d'un feedback sur un message ARIA.
 */
export async function recordAriaFeedback(
  messageId: string,
  feedback: boolean,
  reason?: string
) {
  const message = await prisma.ariaMessage.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });

  if (message?.conversation?.studentId) {
    await prisma.ariaFeedback.create({
      data: {
        messageId,
        studentId: message.conversation.studentId,
        useful: feedback,
        reason: reason || null,
      },
    }).catch(() => {});
  }

  return await prisma.ariaMessage.update({
    where: { id: messageId },
    data: { feedback },
  });
}
