import type { AriaPublicErrorLogger } from '../application/public-error';
import { serializeAriaPublicError } from '../application/public-error';
import type {
  AriaConversationExecutionResult,
  AriaConversationStartEvent,
  RunAriaConversationInput,
} from '../application/conversation/run-conversation';
import { executeAriaConversation } from '../core';
import { AriaError } from '../errors';
import {
  ariaSSEErrorSchema,
  ariaSSEEventSchema,
  type AriaSSECitationPayload,
  type AriaSSEDeltaPayload,
  type AriaSSEDonePayload,
  type AriaSSEErrorPayload,
  type AriaSSEEvent,
  type AriaSSEHeartbeatPayload,
  type AriaSSEMetadataPayload,
  type AriaSSEStartPayload,
} from './contracts';

export type AriaSSEProtocolErrorCode =
  | 'INVALID_CONTENT_TYPE'
  | 'INVALID_EVENT'
  | 'INVALID_JSON'
  | 'INVALID_PAYLOAD'
  | 'UNKNOWN_EVENT'
  | 'START_EVENT_REQUIRED'
  | 'START_EVENT_DUPLICATED'
  | 'TERMINAL_EVENT_DUPLICATED'
  | 'TERMINAL_EVENT_MISSING'
  | 'EVENT_AFTER_TERMINAL'
  | 'EVENT_IDENTITY_MISMATCH'
  | 'ABORTED';

export class AriaSSEParseError extends Error {
  readonly code: AriaSSEProtocolErrorCode;
  readonly eventType?: string;

  constructor(code: AriaSSEProtocolErrorCode, eventType?: string) {
    super(`ARIA_SSE_PROTOCOL_ERROR:${code}`);
    this.name = 'AriaSSEParseError';
    this.code = code;
    this.eventType = eventType;
  }
}

export interface AriaSSECallbacks {
  readonly onStart?: (payload: AriaSSEStartPayload) => void;
  readonly onDelta?: (payload: AriaSSEDeltaPayload) => void;
  readonly onCitation?: (payload: AriaSSECitationPayload) => void;
  readonly onMetadata?: (payload: AriaSSEMetadataPayload) => void;
  readonly onDone?: (payload: AriaSSEDonePayload) => void;
  readonly onError?: (payload: AriaSSEErrorPayload) => void;
  readonly onHeartbeat?: (payload: AriaSSEHeartbeatPayload) => void;
  readonly onProtocolError?: (error: AriaSSEParseError) => void;
}

function protocolFailure(
  code: AriaSSEProtocolErrorCode,
  callbacks: AriaSSECallbacks,
  eventType?: string,
): never {
  const error = new AriaSSEParseError(code, eventType);
  callbacks.onProtocolError?.(error);
  throw error;
}

export function formatAriaSSEEvent(event: AriaSSEEvent): string {
  const parsed = ariaSSEEventSchema.safeParse(event);
  if (!parsed.success) throw new AriaSSEParseError('INVALID_PAYLOAD', String(event.event));
  return `event: ${parsed.data.event}\ndata: ${JSON.stringify(parsed.data.data)}\n\n`;
}

function parseWireEvent(message: string, callbacks: AriaSSECallbacks): AriaSSEEvent {
  let eventType = '';
  const dataLines: string[] = [];
  for (const line of message.split(/\r?\n/)) {
    if (line.startsWith('event:')) eventType = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trimStart());
  }
  if (!eventType || dataLines.length === 0) protocolFailure('INVALID_EVENT', callbacks, eventType);
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    protocolFailure('INVALID_JSON', callbacks, eventType);
  }
  const knownEvents = new Set([
    'start', 'delta', 'citation', 'metadata', 'done', 'error', 'heartbeat',
  ]);
  if (!knownEvents.has(eventType)) protocolFailure('UNKNOWN_EVENT', callbacks, eventType);
  const parsed = ariaSSEEventSchema.safeParse({ event: eventType, data });
  if (!parsed.success) protocolFailure('INVALID_PAYLOAD', callbacks, eventType);
  return parsed.data;
}

function dispatchEvent(event: AriaSSEEvent, callbacks: AriaSSECallbacks): void {
  if (event.event === 'start') callbacks.onStart?.(event.data);
  else if (event.event === 'delta') callbacks.onDelta?.(event.data);
  else if (event.event === 'citation') callbacks.onCitation?.(event.data);
  else if (event.event === 'metadata') callbacks.onMetadata?.(event.data);
  else if (event.event === 'done') callbacks.onDone?.(event.data);
  else if (event.event === 'error') callbacks.onError?.(event.data);
  else callbacks.onHeartbeat?.(event.data);
}

function nextMessage(buffer: string): { readonly message: string; readonly rest: string } | null {
  const boundary = /\r?\n\r?\n/.exec(buffer);
  if (!boundary || boundary.index === undefined) return null;
  return {
    message: buffer.slice(0, boundary.index),
    rest: buffer.slice(boundary.index + boundary[0].length),
  };
}

async function readWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal | undefined,
  callbacks: AriaSSECallbacks,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) return reader.read();
  if (signal.aborted) {
    await reader.cancel();
    return protocolFailure('ABORTED', callbacks);
  }
  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    const onAbort = () => {
      void reader.cancel().finally(() => reject(new AriaSSEParseError('ABORTED')));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    reader.read().then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  }).catch((error: unknown) => {
    if (error instanceof AriaSSEParseError && error.code === 'ABORTED') {
      callbacks.onProtocolError?.(error);
    }
    throw error;
  });
}

export async function parseAriaSSEResponse(
  response: Response,
  callbacks: AriaSSECallbacks,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<void> {
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'text/event-stream') protocolFailure('INVALID_CONTENT_TYPE', callbacks);
  if (!response.body) protocolFailure('INVALID_EVENT', callbacks);

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let started = false;
  let terminal = false;
  let identity: AriaSSEStartPayload | undefined;

  const consume = (message: string) => {
    if (!message.trim()) return;
    const event = parseWireEvent(message, callbacks);
    if (terminal) {
      if (event.event === 'done' || event.event === 'error') {
        protocolFailure('TERMINAL_EVENT_DUPLICATED', callbacks, event.event);
      }
      protocolFailure('EVENT_AFTER_TERMINAL', callbacks, event.event);
    }
    if (event.event === 'heartbeat') {
      dispatchEvent(event, callbacks);
      return;
    }
    if (event.event === 'start') {
      if (started) protocolFailure('START_EVENT_DUPLICATED', callbacks, event.event);
      started = true;
      identity = event.data;
    } else if (!started) {
      protocolFailure('START_EVENT_REQUIRED', callbacks, event.event);
    }
    if (identity && event.event === 'metadata' && (
      event.data.turnId !== identity.turnId || event.data.courseKey !== identity.courseKey
    )) {
      protocolFailure('EVENT_IDENTITY_MISMATCH', callbacks, event.event);
    }
    if (identity && event.event === 'done' && (
      event.data.turnId !== identity.turnId || event.data.messageId !== identity.messageId
    )) {
      protocolFailure('EVENT_IDENTITY_MISMATCH', callbacks, event.event);
    }
    if (
      identity
      && event.event === 'citation'
      && event.data.citation.courseKey !== identity.courseKey
    ) {
      protocolFailure('EVENT_IDENTITY_MISMATCH', callbacks, event.event);
    }
    if (event.event === 'done' || event.event === 'error') {
      terminal = true;
    }
    dispatchEvent(event, callbacks);
  };

  try {
    while (true) {
      const next = await readWithAbort(reader, options.signal, callbacks);
      if (next.done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(next.value, { stream: true });
      while (true) {
        const extracted = nextMessage(buffer);
        if (!extracted) break;
        buffer = extracted.rest;
        consume(extracted.message);
      }
    }
    if (buffer.trim()) consume(buffer);
    if (!started) protocolFailure('START_EVENT_REQUIRED', callbacks);
    if (!terminal) protocolFailure('TERMINAL_EVENT_MISSING', callbacks);
  } catch (error: unknown) {
    if (error instanceof AriaSSEParseError) throw error;
    protocolFailure(options.signal?.aborted ? 'ABORTED' : 'INVALID_EVENT', callbacks);
  } finally {
    reader.releaseLock();
  }
}

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
  executionInput: Omit<RunAriaConversationInput, 'onStart' | 'onDelta' | 'onComplete'>;
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
