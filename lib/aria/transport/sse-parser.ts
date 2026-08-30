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
  | 'EVENT_IDENTITY_MISMATCH' | 'ABORTED';

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

async function readWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal | undefined,
  callbacks: AriaSSECallbacks,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) return reader.read();
  if (signal.aborted) {
    await reader.cancel();
    return fail('ABORTED', callbacks);
  }
  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    const abort = () => {
      void reader.cancel().finally(() => reject(new AriaSSEParseError('ABORTED')));
    };
    signal.addEventListener('abort', abort, { once: true });
    reader.read().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
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
  if (contentType !== 'text/event-stream') fail('INVALID_CONTENT_TYPE', callbacks);
  if (!response.body) fail('INVALID_EVENT', callbacks);
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
    if (event.event === 'done' || event.event === 'error') terminal = true;
    dispatch(event, callbacks);
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
    if (!started) fail('START_EVENT_REQUIRED', callbacks);
    if (!terminal) fail('TERMINAL_EVENT_MISSING', callbacks);
  } catch (error: unknown) {
    if (error instanceof AriaSSEParseError) throw error;
    fail(options.signal?.aborted ? 'ABORTED' : 'INVALID_EVENT', callbacks);
  } finally {
    reader.releaseLock();
  }
}
