/**
 * ARIA Unified Conversation & Orchestration Engine.
 *
 * Point d'entrée UNIQUE pour la génération de réponses ARIA.
 * Invariant : ARIA_GENERATION_PIPELINES=1.
 *
 * Pipeline complet :
 * 1. Vérification d'accès & validation du contexte étudiant
 * 2. Récupération / Création de la conversation en DB
 * 3. Enregistrement du message utilisateur (COMPLETED)
 * 4. Pré-création du message assistant (PENDING)
 * 5. Recherche RAG avec plan explicite (AriaRetrievalPlan)
 * 6. Construction de l'enveloppe de prompt étanche
 * 7. Streaming SSE avec émission des citations, tokens et métadonnées
 * 8. Gestion de l'interruption / annulation (AbortSignal -> CANCELLED)
 * 9. Persistance finale du texte complet et des citations en DB
 */

import { prisma } from '@/lib/prisma';
import { resolveAriaCourseAccess } from './access';
import { buildAriaRetrievalPlan, executeAriaRetrieval } from './rag';
import { buildAriaPromptEnvelope, ARIA_MAX_MESSAGE_LENGTH } from './prompt';
import { streamChatCompletion, getAriaDefaultModel } from './gateway';
import { formatSSEMessage } from './sse';
import type { AriaCitationHit, AriaCourseKey } from './contracts';

export interface AriaConversationStreamRequest {
  readonly studentId: string;
  readonly courseKey?: AriaCourseKey | null;
  readonly skillId?: string | null;
  readonly resourceId?: string | null;
  readonly message: string;
  readonly conversationId?: string | null;
  readonly signal?: AbortSignal;
}

/**
 * Lance le pipeline de conversation ARIA et retourne un ReadableStream SSE.
 */
export async function streamAriaConversation(
  params: AriaConversationStreamRequest
): Promise<ReadableStream<Uint8Array>> {
  const {
    studentId,
    courseKey,
    skillId,
    resourceId,
    message,
    conversationId: providedConvId,
    signal,
  } = params;

  // Validation du message
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error('Message vide');
  }
  if (trimmedMessage.length > ARIA_MAX_MESSAGE_LENGTH) {
    throw new Error(`Message trop long (max ${ARIA_MAX_MESSAGE_LENGTH} caractères)`);
  }

  // 1. Récupération de l'élève et vérification des droits
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      academicEnrollments: true,
      subscriptions: {
        where: { status: 'ACTIVE' },
        take: 1,
      },
    },
  });

  if (!student) {
    throw new Error('Profil élève introuvable');
  }

  if (courseKey) {
    const activeSub = student.subscriptions[0];
    let ariaSubjects: string[] = [];
    if (activeSub?.ariaSubjects) {
      if (Array.isArray(activeSub.ariaSubjects)) {
        ariaSubjects = activeSub.ariaSubjects as string[];
      } else if (typeof activeSub.ariaSubjects === 'string') {
        try {
          ariaSubjects = JSON.parse(activeSub.ariaSubjects);
        } catch {
          ariaSubjects = [activeSub.ariaSubjects];
        }
      }
    }

    const access = resolveAriaCourseAccess({
      courseKey,
      student,
      entitlements: { ariaSubjects, hasGlobalAriaAccess: ariaSubjects.includes('ALL') },
    });

    if (!access.academicallyRelevant) {
      throw new Error(`Ce cours (${courseKey}) ne fait pas partie de votre cursus.`);
    }
  }

  // 2. Gestion de la conversation en DB
  let conversation = providedConvId
    ? await prisma.ariaConversation.findUnique({
        where: { id: providedConvId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10,
          },
        },
      })
    : null;

  if (conversation && conversation.studentId !== studentId) {
    throw new Error('Accès interdit à cette conversation');
  }

  if (!conversation) {
    // Création d'une nouvelle conversation
    const titleSnippet = trimmedMessage.slice(0, 45) + (trimmedMessage.length > 45 ? '...' : '');
    conversation = await prisma.ariaConversation.create({
      data: {
        studentId,
        courseKey: courseKey || null,
        skillId: skillId || null,
        resourceId: resourceId || null,
        title: titleSnippet,
      },
      include: {
        messages: true,
      },
    });
  }

  const conversationId = conversation.id;

  // 3. Persistance du message utilisateur
  await prisma.ariaMessage.create({
    data: {
      conversationId,
      role: 'user',
      content: trimmedMessage,
      status: 'COMPLETED',
    },
  });

  // 4. Pré-création du message assistant en statut PENDING
  const assistantMessageRecord = await prisma.ariaMessage.create({
    data: {
      conversationId,
      role: 'assistant',
      content: '',
      status: 'STREAMING',
    },
  });

  const assistantMessageId = assistantMessageRecord.id;

  // 5. Recherche RAG si un cours est spécifié
  let citations: AriaCitationHit[] = [];
  if (courseKey) {
    const plan = buildAriaRetrievalPlan(courseKey);
    if (plan) {
      const ragResult = await executeAriaRetrieval(plan, trimmedMessage);
      if (ragResult.status === 'SUCCESS') {
        citations = [...ragResult.hits];
      }
    }
  }

  // 6. Construction de l'enveloppe de prompt étanche
  const history = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const promptMessages = buildAriaPromptEnvelope({
    courseKey,
    skillId,
    resourceId,
    citations,
    conversationHistory: history,
    userMessage: trimmedMessage,
  });

  // 7. Création du flux SSE
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const startTime = Date.now();
      let accumulatedText = '';
      const model = getAriaDefaultModel();

      try {
        // Envoi de l'événement start
        controller.enqueue(
          encoder.encode(
            formatSSEMessage('start', {
              conversationId,
              messageId: assistantMessageId,
              model,
              courseKey,
            })
          )
        );

        // Envoi immédiat des citations RAG
        for (const citation of citations) {
          controller.enqueue(
            encoder.encode(
              formatSSEMessage('citation', {
                citation,
              })
            )
          );
        }

        // Appel au gateway de streaming LLM
        for await (const chunk of streamChatCompletion(promptMessages, { model, signal })) {
          if (signal?.aborted) {
            break;
          }
          accumulatedText += chunk;
          controller.enqueue(
            encoder.encode(
              formatSSEMessage('delta', {
                text: chunk,
              })
            )
          );
        }

        const latencyMs = Date.now() - startTime;

        if (signal?.aborted) {
          // Marquer comme CANCELLED en base
          await prisma.ariaMessage.update({
            where: { id: assistantMessageId },
            data: {
              content: accumulatedText,
              status: 'CANCELLED',
            },
          });

          controller.enqueue(
            encoder.encode(
              formatSSEMessage('done', {
                messageId: assistantMessageId,
                status: 'CANCELLED',
                fullText: accumulatedText,
              })
            )
          );
        } else {
          // Persistance complète et statut COMPLETED
          await prisma.ariaMessage.update({
            where: { id: assistantMessageId },
            data: {
              content: accumulatedText,
              status: 'COMPLETED',
            },
          });

          // Persistance des citations attachées à ce message
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

          // Métadonnées
          controller.enqueue(
            encoder.encode(
              formatSSEMessage('metadata', {
                latencyMs,
                finishReason: 'stop',
              })
            )
          );

          // Envoi de l'événement done
          controller.enqueue(
            encoder.encode(
              formatSSEMessage('done', {
                messageId: assistantMessageId,
                status: 'COMPLETED',
                fullText: accumulatedText,
              })
            )
          );
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur interne de conversation';

        // Mise à jour du message en ERROR en base
        await prisma.ariaMessage.update({
          where: { id: assistantMessageId },
          data: {
            status: 'ERROR',
            content: accumulatedText || 'Une erreur est survenue lors de la génération.',
          },
        }).catch(() => {});

        controller.enqueue(
          encoder.encode(
            formatSSEMessage('error', {
              code: 'GENERATION_ERROR',
              message: errorMessage,
              retryable: true,
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });
}
