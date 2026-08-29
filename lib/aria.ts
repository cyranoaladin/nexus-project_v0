/**
 * ARIA Conversation Service — Unifié vers l'architecture canonique.
 *
 * Invariant : ARIA_GENERATION_PIPELINES=1.
 * Délégué vers les services d'orchestration et le gateway de modèle.
 */

import { Subject } from '@/types/enums';
import { prisma } from './prisma';
import { streamAriaConversation } from '@/lib/aria/orchestration';
import { buildAriaPromptEnvelope } from '@/lib/aria/prompt';
import { streamChatCompletion, getAriaDefaultModel } from '@/lib/aria/gateway';
import { buildAriaRetrievalPlan, executeAriaRetrieval } from '@/lib/aria/rag';

function subjectToCourseKey(subject: Subject): string {
  switch (subject) {
    case Subject.MATHEMATIQUES:
      return 'eds-maths-terminale';
    case Subject.NSI:
      return 'eds-nsi-terminale';
    case Subject.FRANCAIS:
      return 'tc-francais-premiere';
    case Subject.PHILOSOPHIE:
      return 'tc-philosophie-terminale';
    default:
      return 'eds-maths-terminale';
  }
}

/**
 * Génération d'une réponse ARIA (mode non-streaming / test / API synchrone).
 */
export async function generateAriaResponse(
  _studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  try {
    const courseKey = subjectToCourseKey(subject);
    const plan = buildAriaRetrievalPlan(courseKey);
    let citations: any[] = [];

    if (plan) {
      const ragResult = await executeAriaRetrieval(plan, message);
      if (ragResult.status === 'SUCCESS') {
        citations = [...ragResult.hits];
      }
    }

    const promptMessages = buildAriaPromptEnvelope({
      courseKey,
      citations,
      conversationHistory,
      userMessage: message,
    });

    let fullText = '';
    for await (const chunk of streamChatCompletion(promptMessages)) {
      fullText += chunk;
    }

    return fullText || "Désolé, je n'ai pas pu générer une réponse.";
  } catch (error) {
    return 'Je rencontre une difficulté technique. Veuillez réessayer ou contacter un coach.';
  }
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
        courseKey: subjectToCourseKey(subject),
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
 * Streaming ARIA délégué directement au moteur d'orchestration unifié.
 */
export async function generateAriaStream(
  studentId: string,
  subject: Subject,
  message: string,
  _conversationHistory: Array<{ role: string; content: string }> = [],
  _onComplete?: (fullResponse: string) => Promise<void>
): Promise<ReadableStream<Uint8Array>> {
  const courseKey = subjectToCourseKey(subject);
  return streamAriaConversation({
    studentId,
    courseKey,
    message,
  });
}

/**
 * Enregistrement d'un feedback sur un message ARIA (compatible table aria_messages et aria_feedbacks).
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
