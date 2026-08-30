import type { AriaPublicErrorLogger } from '../application/public-error';
import { serializeAriaPublicError } from '../application/public-error';
import type {
  AriaConversationExecutionResult,
  AriaConversationStartEvent,
  RunAriaConversationInput,
} from '../application/conversation/public';
import { executeAriaConversation } from '../application/conversation/public';
import { AriaError } from '../errors';
import {
  ariaSSEErrorSchema,
  type AriaSSEErrorPayload,
  type AriaSSEEvent,
  type AriaSSEMetadataPayload,
  type AriaSSEStartPayload,
} from './contracts';
import { formatAriaSSEEvent } from './sse-parser';

export {
  AriaSSEParseError,
  formatAriaSSEEvent,
  parseAriaSSEResponse,
  type AriaSSECallbacks,
  type AriaSSEProtocolErrorCode,
} from './sse-parser';

function metadataFor(
  result: AriaConversationExecutionResult,
  courseKey: string,
): AriaSSEMetadataPayload {
  if (result.status === 'PENDING') {
    throw new AriaError('INTERNAL_ERROR', 500, 'Un Turn PENDING ne peut pas produire de metadata SSE.');
  }
  return {
    turnId: result.turnId,
    courseKey,
    status: result.status,
    disposition: result.disposition,
    ...(result.ragStatus ? { ragStatus: result.ragStatus } : {}),
  };
}

function startPayloadFor(
  event: AriaConversationStartEvent,
  courseKey: string,
): AriaSSEStartPayload {
  if (event.status === 'PENDING') {
    throw new AriaError('INTERNAL_ERROR', 500, 'Un Turn PENDING ne peut pas ouvrir un stream SSE.');
  }
  return {
    turnId: event.turnId,
    conversationId: event.conversationId,
    messageId: event.messageId,
    courseKey,
    status: event.status,
    disposition: event.disposition,
  };
}

function serializePostStartError(
  error: unknown,
  input: Readonly<{
    requestId: string;
    logger?: AriaPublicErrorLogger;
  }>,
): AriaSSEErrorPayload {
  const serialized = serializeAriaPublicError(error, {
    requestId: input.requestId,
    phase: 'POST_START',
    logger: input.logger,
  });
  return ariaSSEErrorSchema.parse(serialized.body.error);
}

export type PreparedAriaSSEConversation =
  | { readonly kind: 'IN_PROGRESS'; readonly result: AriaConversationExecutionResult }
  | { readonly kind: 'STREAM'; readonly stream: ReadableStream<Uint8Array> };

export async function prepareAriaSSEConversation(input: Readonly<{
  executionInput: Omit<RunAriaConversationInput, 'requestId' | 'onStart' | 'onDelta' | 'onComplete'>;
  requestId: string;
  logger?: AriaPublicErrorLogger;
  execute?: typeof executeAriaConversation;
}>): Promise<PreparedAriaSSEConversation> {
  const execute = input.execute ?? executeAriaConversation;
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let detached = false;
  let started = false;
  let resolveStart: (event: AriaConversationStartEvent) => void;
  let rejectStart: (error: unknown) => void;
  const startPromise = new Promise<AriaConversationStartEvent>((resolve, reject) => {
    resolveStart = resolve;
    rejectStart = reject;
  });
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) { controller = streamController; },
    cancel() { detached = true; },
  });
  const emit = (event: AriaSSEEvent) => {
    if (detached || !controller) return;
    const bytes = encoder.encode(formatAriaSSEEvent(event));
    try {
      controller.enqueue(bytes);
    } catch {
      detached = true;
    }
  };
  const close = () => {
    if (detached || !controller) return;
    try { controller.close(); } catch { detached = true; }
  };

  const execution = execute({
    ...input.executionInput,
    requestId: input.requestId,
    onStart(event) {
      try {
        if (event.disposition !== 'IN_PROGRESS') {
          emit({
            event: 'start',
            data: startPayloadFor(event, input.executionInput.context.courseKey),
          });
        }
        started = true;
        resolveStart(event);
      } catch (error: unknown) {
        rejectStart(error);
        throw error;
      }
    },
    onDelta(text) { emit({ event: 'delta', data: { text } }); },
  });

  void execution.then((result) => {
    if (!started) {
      rejectStart(new Error('ARIA_EXECUTION_START_EVENT_MISSING'));
      close();
      return;
    }
    if (result.disposition === 'IN_PROGRESS') {
      close();
      return;
    }
    if (result.disposition === 'REPLAY' && result.fullText) {
      emit({ event: 'delta', data: { text: result.fullText } });
    }
    for (const citation of result.citations) {
      emit({ event: 'citation', data: { citation } });
    }
    emit({ event: 'metadata', data: metadataFor(result, input.executionInput.context.courseKey) });
    if (result.status === 'COMPLETED' || result.status === 'CANCELLED') {
      emit({
        event: 'done',
        data: {
          turnId: result.turnId,
          messageId: result.messageId,
          status: result.status,
          fullText: result.fullText,
        },
      });
    } else {
      emit({
        event: 'error',
        data: serializePostStartError(
          new AriaError(
            result.failureCode ?? 'INTERNAL_ERROR',
            500,
            'L’exécution ARIA s’est terminée en erreur.',
          ),
          input,
        ),
      });
    }
    close();
  }).catch((error: unknown) => {
    if (!started) {
      rejectStart(error);
      close();
      return;
    }
    emit({ event: 'error', data: serializePostStartError(error, input) });
    close();
  });

  const start = await startPromise;
  if (start.disposition === 'IN_PROGRESS') {
    return { kind: 'IN_PROGRESS', result: await execution };
  }
  return { kind: 'STREAM', stream };
}
