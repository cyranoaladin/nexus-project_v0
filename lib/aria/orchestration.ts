/**
 * ARIA Conversation Orchestration & Transport Adapters.
 *
 * Expose les adaptateurs SSE et JSON au-dessus du moteur canonique unique executeAriaConversation.
 * Invariants :
 * - ARIA_GENERATION_PIPELINES=1
 * - ARIA_PERSISTENCE_PIPELINES=1
 * - ARIA_RETRIEVAL_PIPELINES=1
 * - ARIA_PROMPT_BUILDERS=1
 */

import { formatSSEMessage } from './sse';
import { resolveAriaExecutionContext, type ResolveExecutionContextParams } from './context';
import { executeAriaConversation, type AriaExecutionResult } from './core';
import type { AriaCourseKey, AriaSSEEvent } from './contracts';

export interface AriaConversationStreamRequest {
  readonly studentId: string;
  readonly courseKey: AriaCourseKey;
  readonly skillId?: string | null;
  readonly resourceId?: string | null;
  readonly message: string;
  readonly conversationId?: string | null;
  readonly signal?: AbortSignal;
  readonly onComplete?: (fullText: string) => void | Promise<void>;
}

/**
 * Adaptateur de transport SSE : retourne un ReadableStream<Uint8Array>.
 */
export async function streamAriaConversation(
  params: AriaConversationStreamRequest
): Promise<ReadableStream<Uint8Array>> {
  const { studentId, courseKey, skillId, resourceId, message, conversationId, signal, onComplete } = params;

  // 1. Autorisation et résolution du contexte immuable
  const context = await resolveAriaExecutionContext({
    studentId,
    courseKey,
    skillId,
    resourceId,
  });

  const encoder = new TextEncoder();

  // 2. Flux SSE s'appuyant directement sur le moteur unique
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await executeAriaConversation({
          context,
          message,
          conversationId,
          signal,
          onComplete,
          onEvent(event: AriaSSEEvent) {
            try {
              controller.enqueue(encoder.encode(formatSSEMessage(event.event, event.data)));
            } catch {
              // Contrôleur potentiellement fermé si le client s'est déconnecté
            }
          },
        });
      } catch (error: unknown) {
        try {
          const errPayload = {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Erreur d\'exécution ARIA',
            retryable: false,
          };
          controller.enqueue(encoder.encode(formatSSEMessage('error', errPayload)));
        } catch {
          // Contrôleur potentiellement fermé
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Contrôleur déjà fermé
        }
      }
    },
  });
}

/**
 * Adaptateur de transport JSON : exécute le moteur unique et retourne le résultat complet.
 */
export async function executeAriaConversationJson(
  params: AriaConversationStreamRequest & { studentOverride?: ResolveExecutionContextParams['studentOverride'] }
): Promise<AriaExecutionResult> {
  const { studentId, courseKey, skillId, resourceId, message, conversationId, signal, studentOverride } = params;

  const context = await resolveAriaExecutionContext({
    studentId,
    courseKey,
    skillId,
    resourceId,
    studentOverride,
  });

  return await executeAriaConversation({
    context,
    message,
    conversationId,
    signal,
  });
}
