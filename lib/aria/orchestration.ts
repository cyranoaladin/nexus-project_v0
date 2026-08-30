import { logger } from '@/lib/logger';
import { executeAriaConversation, type AriaExecutionResult } from './core';
import { formatSSEMessage } from './sse';
import type { AriaConversationContext } from './application/conversation/public';
import type { AriaPedagogicalMode } from './domain/pedagogy/pedagogical-mode';

export interface AriaConversationStreamRequest {
  readonly context: AriaConversationContext;
  readonly clientRequestId: string;
  readonly message: string;
  readonly pedagogicalMode?: AriaPedagogicalMode;
}

function safeEnqueue(
  controller: ReadableStreamDefaultController<Uint8Array>,
  bytes: Uint8Array,
  state: { detached: boolean },
): void {
  if (state.detached) return;
  try {
    controller.enqueue(bytes);
  } catch {
    state.detached = true;
    logger.warn({ operation: 'ARIA_SSE_TRANSPORT_DETACHED' }, 'ARIA SSE transport detached');
  }
}

/** Transport detachment never cancels the canonical Turn execution. */
export async function streamAriaConversation(
  input: AriaConversationStreamRequest,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const state = { detached: false };
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await executeAriaConversation({
          ...input,
          onDelta: (text) => safeEnqueue(
            controller,
            encoder.encode(formatSSEMessage('delta', { text })),
            state,
          ),
        });
        safeEnqueue(controller, encoder.encode(formatSSEMessage('done', {
          turnId: result.turnId,
          messageId: result.messageId,
          status: result.status,
          fullText: result.fullText,
          ragStatus: result.ragStatus,
        })), state);
      } catch {
        safeEnqueue(controller, encoder.encode(formatSSEMessage('error', {
          code: 'INTERNAL_ERROR',
          message: 'Une difficulté technique temporaire est survenue.',
          retryable: false,
        })), state);
      } finally {
        if (!state.detached) {
          try {
            controller.close();
          } catch {
            logger.warn({ operation: 'ARIA_SSE_TRANSPORT_CLOSE_FAILED' }, 'ARIA SSE close failed');
          }
        }
      }
    },
  });
}

export function executeAriaConversationJson(
  input: AriaConversationStreamRequest,
): Promise<AriaExecutionResult> {
  return executeAriaConversation(input);
}
