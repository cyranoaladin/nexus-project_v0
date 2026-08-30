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
import { executeAriaConversation, type AriaExecutionResult } from './core';
import type { AriaSSEEvent } from './contracts';
import type { AriaConversationContext } from './application/conversation/public';

export interface AriaConversationStreamRequest {
  readonly context: AriaConversationContext;
  readonly message: string;
  readonly signal?: AbortSignal;
  readonly onComplete?: (fullText: string) => void | Promise<void>;
}

/**
 * Adaptateur de transport SSE : retourne un ReadableStream<Uint8Array>.
 */
export async function streamAriaConversation(
  params: AriaConversationStreamRequest
): Promise<ReadableStream<Uint8Array>> {
  const { context, message, signal, onComplete } = params;

  const encoder = new TextEncoder();

  // 2. Flux SSE s'appuyant directement sur le moteur unique
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await executeAriaConversation({
          context,
          message,
          conversationId: context.conversation?.id,
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
  params: AriaConversationStreamRequest,
): Promise<AriaExecutionResult> {
  const { context, message, signal } = params;

  return await executeAriaConversation({
    context,
    message,
    conversationId: context.conversation?.id,
    signal,
  });
}
