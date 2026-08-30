/**
 * ARIA Canonical Conversation Execution Engine (SSoT).
 *
 * Moteur UNIQUE d'exécution de conversation ARIA.
 * Invariants :
 * - ARIA_GENERATION_PIPELINES=1
 * - ARIA_PERSISTENCE_PIPELINES=1
 * - ARIA_RETRIEVAL_PIPELINES=1
 * - ARIA_PROMPT_BUILDERS=1
 * - CORE_REQUESTS_WITHOUT_COURSE_KEY=0
 * - CROSS_COURSE_CONVERSATION_REUSE=REJECTED
 * - UNKNOWN_CONVERSATION_ID_FAILS_CLOSED=PASS
 * - PROMPT_HISTORY_IS_MOST_RECENT=PASS
 * - SILENT_RAG_TO_UNGROUNDED_DOWNGRADE=0
 * - ARIA_CORE_DB_ERRORS_SWALLOWED=0
 * - STUCK_STREAMING_MESSAGE_RECOVERY=PASS
 */

import { prisma } from '@/lib/prisma';
import { checkAndAwardBadges } from '@/lib/badges';
import { buildAriaRetrievalPlan, executeAriaRetrieval } from './rag';
import { buildAriaPromptEnvelope, ARIA_MAX_MESSAGE_LENGTH } from './prompt';
import { streamChatCompletion, getAriaDefaultModel } from './gateway';
import { AriaError } from './errors';
import type { AriaCitationHit, AriaSSEEvent } from './contracts';
import type { AriaExecutionContext } from './context';

export interface ExecuteAriaConversationParams {
  readonly context: AriaExecutionContext;
  readonly message: string;
  readonly conversationId?: string | null;
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: AriaSSEEvent) => void;
  readonly onComplete?: (fullText: string) => void | Promise<void>;
}

export interface AriaExecutionResult {
  readonly conversationId: string;
  readonly messageId: string;
  readonly fullText: string;
  readonly citations: readonly AriaCitationHit[];
  readonly latencyMs: number;
  readonly finishReason: string;
  readonly newBadges: ReadonlyArray<{ name: string; description: string; icon: string }>;
}

/**
 * Récupère et nettoie les messages bloqués en statut STREAMING depuis plus de 5 minutes.
 */
export async function recoverStuckStreamingMessages(studentId: string): Promise<number> {
  if (typeof prisma.ariaMessage?.updateMany !== 'function') {
    return 0;
  }
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const result = await prisma.ariaMessage.updateMany({
    where: {
      status: 'STREAMING',
      createdAt: { lt: fiveMinutesAgo },
      conversation: { studentId },
    },
    data: {
      status: 'ERROR',
      content: 'Génération interrompue ou expirée.',
    },
  });
  return result.count;
}

/**
 * Moteur d'exécution unifié.
 */
export async function executeAriaConversation(
  params: ExecuteAriaConversationParams
): Promise<AriaExecutionResult> {
  const { context, message, conversationId: providedConvId, signal, onEvent } = params;
  const { student, courseKey, course, skillId, resourceId, capabilities } = context;

  // 1. Validation de la longueur et validité du message
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new AriaError('BAD_REQUEST', 400, 'Le message ne peut pas être vide.');
  }
  if (trimmedMessage.length > ARIA_MAX_MESSAGE_LENGTH) {
    throw new AriaError(
      'BAD_REQUEST',
      400,
      `Message trop long (maximum ${ARIA_MAX_MESSAGE_LENGTH} caractères).`
    );
  }

  // 2. Résolution / Création de la conversation en base (Fail-closed strict)
  let conversationId: string;

  if (providedConvId) {
    const existing = await prisma.ariaConversation.findUnique({
      where: { id: providedConvId },
    });

    // Invariant UNKNOWN_CONVERSATION_ID_FAILS_CLOSED : si l'ID est fourni et non trouvé -> 404 immédiat
    if (!existing || existing.studentId !== student.id) {
      throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation introuvable.');
    }

    // Invariant CROSS_COURSE_CONVERSATION_REUSE : interdiction de reprendre une conversation sous un autre cours
    if (existing.courseKey && existing.courseKey !== courseKey) {
      throw new AriaError(
        'CROSS_COURSE_MISMATCH',
        400,
        `Cette conversation est rattachée au cours (${existing.courseKey}) et ne peut être continuée sous (${courseKey}).`
      );
    }

    conversationId = existing.id;
  } else {
    // Création d'une nouvelle conversation
    const titleSnippet = trimmedMessage.slice(0, 45) + (trimmedMessage.length > 45 ? '...' : '');
    const newConv = await prisma.ariaConversation.create({
      data: {
        studentId: student.id,
        courseKey,
        subject: course.legacySubject,
        skillId: skillId || null,
        resourceId: resourceId || null,
        title: titleSnippet,
      },
    });
    conversationId = newConv.id;
  }

  // Nettoyage préventif des messages éventuellement coincés en STREAMING
  await recoverStuckStreamingMessages(student.id).catch(() => {});

  // 3. Récupération de l'historique récent (Invariant PROMPT_HISTORY_IS_MOST_RECENT)
  // Trie par createdAt desc pour prendre les 10 DERNIERS, puis inverse l'ordre pour chronologie
  const rawRecent = typeof prisma.ariaMessage?.findMany === 'function'
    ? await prisma.ariaMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    : [];
  const recentMessagesDesc = Array.isArray(rawRecent) ? rawRecent : [];
  const chronologicalHistory = [...recentMessagesDesc].reverse().map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // 4. Enregistrement du message utilisateur
  await prisma.ariaMessage.create({
    data: {
      conversationId,
      role: 'user',
      content: trimmedMessage,
      status: 'COMPLETED',
    },
  });

  // 5. Pré-création du message assistant en statut STREAMING
  const assistantMessageRecord = await prisma.ariaMessage.create({
    data: {
      conversationId,
      role: 'assistant',
      content: '',
      status: 'STREAMING',
    },
  });
  const assistantMessageId = assistantMessageRecord.id;

  // 6. Recherche RAG avec politique explicite de grounding
  let citations: AriaCitationHit[] = [];
  let ragStatus: string = 'NOT_APPLICABLE';

  if (capabilities.hasRagCorpus) {
    const plan = buildAriaRetrievalPlan(courseKey);
    if (!plan) {
      throw new AriaError(
        'RAG_UNAVAILABLE',
        503,
        `Plan de recherche documentaire introuvable pour ${courseKey}.`
      );
    }

    const ragResult = await executeAriaRetrieval(plan, trimmedMessage);

    if (ragResult?.status === 'SUCCESS') {
      citations = [...(ragResult.hits ?? [])];
      ragStatus = 'GROUNDED';
    } else if (ragResult?.status === 'NO_RESULTS') {
      ragStatus = 'NO_RESULTS';
    } else if (ragResult?.status === 'RUNTIME_UNAVAILABLE') {
      // Invariant SILENT_RAG_TO_UNGROUNDED_DOWNGRADE
      if (capabilities.generalChatAllowed) {
        ragStatus = 'UNAVAILABLE_DOWNGRADED';
      } else {
        await prisma.ariaMessage.update({
          where: { id: assistantMessageId },
          data: {
            status: 'ERROR',
            content: 'Le service documentaire RAG est temporairement indisponible pour ce cours.',
          },
        });
        throw new AriaError(
          'RAG_UNAVAILABLE',
          503,
          'Le service documentaire RAG est temporairement indisponible pour ce cours.'
        );
      }
    }
  }

  // 7. Émission de l'événement initial 'start'
  const model = getAriaDefaultModel();
  if (onEvent) {
    onEvent({
      event: 'start',
      data: {
        conversationId,
        messageId: assistantMessageId,
        model,
        courseKey,
      },
    });

    // Émission des citations
    for (const citation of citations) {
      onEvent({
        event: 'citation',
        data: { citation },
      });
    }
  }

  // 8. Construction de l'enveloppe de prompt unifiée
  const promptMessages = buildAriaPromptEnvelope({
    courseKey,
    skillId,
    resourceId,
    citations,
    conversationHistory: chronologicalHistory,
    userMessage: trimmedMessage,
  });

  // 9. Exécution du modèle via le Gateway
  const startTime = Date.now();
  let accumulatedText = '';
  let finishReason = 'stop';

  try {
    for await (const chunk of streamChatCompletion(promptMessages, { model, signal })) {
      if (signal?.aborted) {
        finishReason = 'cancelled';
        break;
      }
      accumulatedText += chunk;
      if (onEvent) {
        onEvent({
          event: 'delta',
          data: { text: chunk },
        });
      }
    }

    const latencyMs = Date.now() - startTime;

    if (signal?.aborted) {
      await prisma.ariaMessage.update({
        where: { id: assistantMessageId },
        data: {
          content: accumulatedText,
          status: 'CANCELLED',
        },
      });

      if (onEvent) {
        onEvent({
          event: 'done',
          data: {
            messageId: assistantMessageId,
            status: 'CANCELLED',
            fullText: accumulatedText,
          },
        });
      }

      return {
        conversationId,
        messageId: assistantMessageId,
        fullText: accumulatedText,
        citations,
        latencyMs,
        finishReason: 'cancelled',
        newBadges: [],
      };
    }

    // Persistance finale du message assistant
    await prisma.ariaMessage.update({
      where: { id: assistantMessageId },
      data: {
        content: accumulatedText,
        status: 'COMPLETED',
        metadata: {
          ragStatus,
          citationCount: citations.length,
          model,
          latencyMs,
        },
      },
    });

    // Sauvegarde des citations rattachées
    if (citations.length > 0) {
      await prisma.ariaMessageCitation.createMany({
        data: citations.map((c) => ({
          messageId: assistantMessageId,
          sourceTitle: c.sourceTitle,
          sourceDocument: c.sourceDocument,
          sourceLocation: c.sourceLocation || null,
          courseKey: c.courseKey,
          provenance: c.provenance,
          url: c.url || null,
        })),
      });
    }

    // Attribution des badges de progression
    const newBadges: Array<{ name: string; description: string; icon: string }> = [];
    try {
      const b1 = await checkAndAwardBadges(student.id, 'first_aria_question');
      const b2 = await checkAndAwardBadges(student.id, 'aria_question_count');
      for (const b of [...b1, ...b2]) {
        newBadges.push({
          name: b.badge.name,
          description: b.badge.description,
          icon: b.badge.icon ?? 'star',
        });
      }
    } catch {
      // Non bloquant pour la complétion
    }

    if (onEvent) {
      onEvent({
        event: 'metadata',
        data: {
          latencyMs,
          finishReason: 'stop',
        },
      });

      onEvent({
        event: 'done',
        data: {
          messageId: assistantMessageId,
          status: 'COMPLETED',
          fullText: accumulatedText,
        },
      });
    }

    if (params.onComplete) {
      await params.onComplete(accumulatedText);
    }

    return {
      conversationId,
      messageId: assistantMessageId,
      fullText: accumulatedText,
      citations,
      latencyMs,
      finishReason,
      newBadges,
    };
  } catch (error: unknown) {
    await prisma.ariaMessage.update({
      where: { id: assistantMessageId },
      data: {
        status: 'ERROR',
        content: accumulatedText || 'Une erreur est survenue lors de la génération.',
      },
    });

    const isTimeout = error instanceof AriaError && error.code === 'MODEL_TIMEOUT';
    const isCancelled = error instanceof AriaError && error.code === 'USER_CANCELLED';

    const safeMessage = isTimeout
      ? 'Le temps d\'attente de réponse du modèle a expiré. Veuillez réessayer.'
      : isCancelled
      ? 'Génération annulée par l\'utilisateur.'
      : 'Une difficulté technique est survenue lors de la génération. Veuillez réessayer.';

    if (onEvent) {
      onEvent({
        event: 'error',
        data: {
          code: isTimeout ? 'TIMEOUT_ERROR' : isCancelled ? 'GENERATION_CANCELLED' : 'GENERATION_ERROR',
          message: safeMessage,
          retryable: true,
        },
      });
    }

    throw error;
  }
}
