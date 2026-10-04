import { createNativeResponseReader } from './native-response-reader';
import {
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
  | 'INVALID_CONTENT_TYPE' | 'INVALID_EVENT' | 'INVALID_JSON' | 'INVALID_PAYLOAD'
  | 'UNKNOWN_EVENT' | 'START_EVENT_REQUIRED' | 'START_EVENT_DUPLICATED'
  | 'TERMINAL_EVENT_DUPLICATED' | 'TERMINAL_EVENT_MISSING' | 'EVENT_AFTER_TERMINAL'
  | 'EVENT_IDENTITY_MISMATCH' | 'ABORTED' | 'TERMINAL_DRAIN_TIMEOUT' | 'TRANSPORT_CLEANUP_FAILED';

const TERMINAL_DRAIN_TIMEOUT_MS = 5_000;
const TERMINAL_DRAIN_TIMEOUT_REASON = Symbol('ARIA_TERMINAL_DRAIN_TIMEOUT');

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

function fail(
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
    if (line.startsWith('event:')) eventType = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (!eventType || dataLines.length === 0) fail('INVALID_EVENT', callbacks, eventType);
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    fail('INVALID_JSON', callbacks, eventType);
  }
  if (!['start', 'delta', 'citation', 'metadata', 'done', 'error', 'heartbeat'].includes(eventType)) {
    fail('UNKNOWN_EVENT', callbacks, eventType);
  }
  const parsed = ariaSSEEventSchema.safeParse({ event: eventType, data });
  if (!parsed.success) fail('INVALID_PAYLOAD', callbacks, eventType);
  return parsed.data;
}

function dispatch(event: AriaSSEEvent, callbacks: AriaSSECallbacks): void {
  if (event.event === 'start') callbacks.onStart?.(event.data);
  else if (event.event === 'delta') callbacks.onDelta?.(event.data);
  else if (event.event === 'citation') callbacks.onCitation?.(event.data);
  else if (event.event === 'metadata') callbacks.onMetadata?.(event.data);
  else if (event.event === 'done') callbacks.onDone?.(event.data);
  else if (event.event === 'error') callbacks.onError?.(event.data);
  else callbacks.onHeartbeat?.(event.data);
}

function nextMessage(buffer: string): { message: string; rest: string } | null {
  const boundary = /\r?\n\r?\n/.exec(buffer);
  if (!boundary || boundary.index === undefined) return null;
  return {
    message: buffer.slice(0, boundary.index),
    rest: buffer.slice(boundary.index + boundary[0].length),
  };
}

function abortCode(signal: AbortSignal): AriaSSEProtocolErrorCode {
  return signal.reason === TERMINAL_DRAIN_TIMEOUT_REASON ? 'TERMINAL_DRAIN_TIMEOUT' : 'ABORTED';
}

async function readWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
  callbacks: AriaSSECallbacks,
  cancel: () => Promise<boolean>,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) {
    await cancel();
    return fail(abortCode(signal), callbacks);
  }
  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    const abort = () => {
      reject(new AriaSSEParseError(abortCode(signal)));
      void cancel().then(undefined, reject);
    };
    signal.addEventListener('abort', abort, { once: true });
    reader.read().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  }).catch((error: unknown) => {
    if (error instanceof AriaSSEParseError && ['ABORTED', 'TERMINAL_DRAIN_TIMEOUT'].includes(error.code)) {
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
  if (contentType !== 'text/event-stream') fail('INVALID_CONTENT_TYPE', callbacks);
  if (!response.body) fail('INVALID_EVENT', callbacks);
  if (options.signal?.aborted) {
    await response.body.cancel();
    fail('ABORTED', callbacks);
  }
  const transport = createNativeResponseReader(response);
  const reader = transport.reader;
  let ended = false;
  let failed = false;
  const drainController = new AbortController();
  const forwardAbort = () => drainController.abort(options.signal?.reason);
  if (options.signal?.aborted) forwardAbort();
  else options.signal?.addEventListener('abort', forwardAbort, { once: true });
  let drainTimer: ReturnType<typeof setTimeout> | undefined;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let started = false;
  let terminal = false;
  let terminalEvent: AriaSSEEvent | undefined;
  let identity: AriaSSEStartPayload | undefined;
  const consume = (message: string) => {
    if (!message.trim()) return;
    const event = parseWireEvent(message, callbacks);
    if (terminal) {
      if (event.event === 'done' || event.event === 'error') {
        fail('TERMINAL_EVENT_DUPLICATED', callbacks, event.event);
      }
      fail('EVENT_AFTER_TERMINAL', callbacks, event.event);
    }
    if (event.event === 'heartbeat') {
      dispatch(event, callbacks);
      return;
    }
    if (event.event === 'start') {
      if (started) fail('START_EVENT_DUPLICATED', callbacks, event.event);
      started = true;
      identity = event.data;
    } else if (!started) {
      fail('START_EVENT_REQUIRED', callbacks, event.event);
    }
    if (identity && event.event === 'metadata'
      && (event.data.turnId !== identity.turnId || event.data.courseKey !== identity.courseKey)) {
      fail('EVENT_IDENTITY_MISMATCH', callbacks, event.event);
    }
    if (identity && event.event === 'done'
      && (event.data.turnId !== identity.turnId || event.data.messageId !== identity.messageId)) {
      fail('EVENT_IDENTITY_MISMATCH', callbacks, event.event);
    }
    if (identity && event.event === 'citation'
      && event.data.citation.courseKey !== identity.courseKey) {
      fail('EVENT_IDENTITY_MISMATCH', callbacks, event.event);
    }
    if (event.event === 'done' || event.event === 'error') {
      terminal = true;
      terminalEvent = event;
      // The server closes after its terminal frame. A proxy/transport which
      // fails to forward EOF must not leave the composer blocked indefinitely.
      drainTimer = setTimeout(() => drainController.abort(TERMINAL_DRAIN_TIMEOUT_REASON), TERMINAL_DRAIN_TIMEOUT_MS);
      return;
    }
    dispatch(event, callbacks);
  };
  try {
    while (true) {
      const next = await readWithAbort(reader, drainController.signal, callbacks, transport.cancel);
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
      transport.acknowledge();
    }
    await transport.finish();
    if (drainController.signal.aborted) fail(abortCode(drainController.signal), callbacks);
    ended = true;
    if (buffer.trim()) consume(buffer);
    if (!started) fail('START_EVENT_REQUIRED', callbacks);
    if (!terminal || !terminalEvent) fail('TERMINAL_EVENT_MISSING', callbacks);
    // A terminal frame is not yet an EOF. Announcing READY before the body
    // finishes lets the next send/unmount abort a still-attached fetch, and
    // incorrectly announces completion for an invalid trailing frame.
    dispatch(terminalEvent, callbacks);
  } catch (error: unknown) {
    failed = true;
    if (error instanceof AriaSSEParseError) throw error;
    fail('INVALID_EVENT', callbacks);
  } finally {
    if (drainTimer !== undefined) clearTimeout(drainTimer);
    options.signal?.removeEventListener('abort', forwardAbort);
    const cleaned = ended || await transport.cancel();
    transport.release();
    if (!cleaned && !failed) fail('TRANSPORT_CLEANUP_FAILED', callbacks);
  }
}
