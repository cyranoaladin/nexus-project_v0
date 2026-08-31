'use client';

import type { AriaSSECallbacks } from './transport/sse-parser';
import { AriaSSEParseError, parseAriaSSEResponse } from './transport/sse-parser';
import { ariaHistoryCitationSchema } from './domain/retrieval/history-citation';
import {
  ariaLearningPreferencesV1Schema,
  type AriaLearningPreferencesV1,
} from './domain/profile/preferences';
import {
  ariaCancellationResponseSchema,
  ariaFeedbackResponseSchema,
  ariaHistoryConversationSchema,
  ariaPendingResponseSchema,
  type AriaCancellationResponse,
  type AriaFeedbackResponse,
  type AriaHistoryConversation,
  type AriaPendingResponse,
} from './transport/contracts';
import type { AriaPedagogicalMode } from './domain/pedagogy/pedagogical-mode';

export interface AriaClientCourse {
  readonly courseKey: string;
  readonly label: string;
  readonly capabilities: { readonly hasChat: boolean };
  readonly access: {
    readonly status: 'AVAILABLE' | 'LOCKED' | 'UNSUPPORTED';
    readonly commerciallyEntitled: boolean;
    readonly lockReason?: string | null;
  };
}

export interface AriaClientCitation {
  readonly id: string;
  readonly sourceTitle: string;
  readonly sourceLocation?: string | null;
  readonly traceability?: 'CANONICAL' | 'LEGACY_UNTRACEABLE';
  readonly [key: string]: unknown;
}

export interface AriaClientMessage {
  readonly id: string;
  readonly turnId: string | null;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly status: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
  readonly citations: readonly AriaClientCitation[];
  readonly feedback: boolean | null;
}

export interface AriaClientConversationHistory {
  readonly messages: readonly AriaClientMessage[];
  readonly activeTurn: AriaHistoryConversation['activeTurn'];
}

export interface AriaClientRequest {
  readonly clientRequestId: string;
  readonly courseKey: string;
  readonly content: string;
  readonly conversationId?: string;
  readonly pedagogicalMode?: AriaPedagogicalMode;
}

export type AriaClientPendingTransport = AriaPendingResponse;
export type AriaClientCancellation = AriaCancellationResponse;

export interface AriaConversationTransportCallbacks extends AriaSSECallbacks {
  readonly onPending?: (payload: AriaClientPendingTransport) => void;
}

export class AriaClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(`ARIA_CLIENT_ERROR:${code}`);
    this.name = 'AriaClientError';
  }
}

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AriaClientError('INVALID_RESPONSE', response.status || 500, false);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AriaClientError('INVALID_RESPONSE', 500, false);
  }
  return value as Record<string, unknown>;
}

async function requireOk(response: Response): Promise<unknown> {
  const body = await json(response);
  if (response.ok) return body;
  const envelope = object(body).error;
  const error = object(envelope);
  throw new AriaClientError(
    typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR',
    response.status,
    error.retryable === true,
  );
}

export function createAriaClientRequest(
  input: Readonly<{
    courseKey: string;
    content: string;
    conversationId: string | null;
    pedagogicalMode?: AriaPedagogicalMode;
  }>,
  createId: () => string = createBrowserUuid,
): AriaClientRequest {
  return Object.freeze({
    clientRequestId: createId(),
    courseKey: input.courseKey,
    content: input.content,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(input.pedagogicalMode ? { pedagogicalMode: input.pedagogicalMode } : {}),
  });
}

function createBrowserUuid(): string {
  const browserCrypto = globalThis.crypto;
  if (typeof browserCrypto?.randomUUID === 'function') return browserCrypto.randomUUID();
  if (typeof browserCrypto?.getRandomValues !== 'function') {
    throw new AriaClientError('CLIENT_CRYPTO_UNAVAILABLE', 500, false);
  }
  const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export async function fetchAriaCurriculum(signal?: AbortSignal): Promise<{
  readonly courses: readonly AriaClientCourse[];
  readonly profile: AriaLearningPreferencesV1;
}> {
  const body = object(await requireOk(await fetch('/api/aria/curriculum', { signal })));
  if (!Array.isArray(body.courses)) throw new AriaClientError('INVALID_RESPONSE', 500, false);
  const courses = body.courses.map((raw) => {
    const course = object(raw);
    const capabilities = object(course.capabilities);
    const access = object(course.access);
    if (typeof course.courseKey !== 'string' || typeof course.label !== 'string'
      || typeof capabilities.hasChat !== 'boolean'
      || !['AVAILABLE', 'LOCKED', 'UNSUPPORTED'].includes(String(access.status))
      || typeof access.commerciallyEntitled !== 'boolean') {
      throw new AriaClientError('INVALID_RESPONSE', 500, false);
    }
    return Object.freeze({
      courseKey: course.courseKey,
      label: course.label,
      capabilities: Object.freeze({ hasChat: capabilities.hasChat }),
      access: Object.freeze({
        status: access.status as AriaClientCourse['access']['status'],
        commerciallyEntitled: access.commerciallyEntitled,
        lockReason: typeof access.lockReason === 'string' ? access.lockReason : null,
      }),
    });
  });
  const parsedProfile = ariaLearningPreferencesV1Schema.safeParse(body.profile);
  if (!parsedProfile.success) throw new AriaClientError('INVALID_RESPONSE', 500, false);
  const courseKeys = new Set(courses.map(({ courseKey }) => courseKey));
  const referencedCourseKeys = [
    ...parsedProfile.data.pinnedCourseKeys,
    ...parsedProfile.data.courseOrder,
    ...(parsedProfile.data.focusedCourseKey ? [parsedProfile.data.focusedCourseKey] : []),
  ];
  if (referencedCourseKeys.some((courseKey) => !courseKeys.has(courseKey))) {
    throw new AriaClientError('INVALID_RESPONSE', 500, false);
  }
  const profile = Object.freeze({
    ...parsedProfile.data,
    pinnedCourseKeys: Object.freeze(parsedProfile.data.pinnedCourseKeys),
    courseOrder: Object.freeze(parsedProfile.data.courseOrder),
  });
  return Object.freeze({
    courses: Object.freeze(courses),
    profile,
  });
}

export async function fetchLatestAriaConversation(
  courseKey: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await fetch(`/api/aria/conversations?courseKey=${encodeURIComponent(courseKey)}&limit=1`, { signal });
  const body = object(await requireOk(response));
  if (!Array.isArray(body.conversations)) throw new AriaClientError('INVALID_RESPONSE', 500, false);
  const first = body.conversations[0];
  if (first === undefined) return null;
  const conversation = object(first);
  return typeof conversation.id === 'string' && conversation.resumable === true
    ? conversation.id
    : null;
}

export async function fetchAriaConversationHistory(
  conversationId: string,
  signal?: AbortSignal,
): Promise<AriaClientConversationHistory> {
  const pages: AriaClientMessage[][] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let canonicalConversation: AriaHistoryConversation | null = null;
  for (let pageNumber = 0; pageNumber < 200; pageNumber += 1) {
    const query = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const response = await fetch(
      `/api/aria/conversations/${encodeURIComponent(conversationId)}/messages?limit=50${query}`,
      { signal },
    );
    const body = object(await requireOk(response));
    const parsedConversation = ariaHistoryConversationSchema.safeParse(body.conversation);
    if (!parsedConversation.success || parsedConversation.data.id !== conversationId) {
      throw new AriaClientError('INVALID_RESPONSE', 500, false);
    }
    if (canonicalConversation === null) canonicalConversation = parsedConversation.data;
    else if (parsedConversation.data.id !== canonicalConversation.id
      || parsedConversation.data.courseKey !== canonicalConversation.courseKey) {
      throw new AriaClientError('INVALID_RESPONSE', 500, false);
    }
    if (!Array.isArray(body.messages)) throw new AriaClientError('INVALID_RESPONSE', 500, false);
    pages.unshift(body.messages.map((raw) => {
      const message = object(raw);
      if (typeof message.messageId !== 'string'
        || !(message.turnId === null || typeof message.turnId === 'string')
        || typeof message.content !== 'string'
        || !['user', 'assistant', 'system'].includes(String(message.role))
        || !['PENDING', 'STREAMING', 'COMPLETED', 'CANCELLED', 'ERROR'].includes(String(message.status))
        || !Array.isArray(message.citations)) {
        throw new AriaClientError('INVALID_RESPONSE', 500, false);
      }
      const citations = message.citations.map((citation) => {
        const parsed = ariaHistoryCitationSchema.safeParse(citation);
        if (!parsed.success) throw new AriaClientError('INVALID_RESPONSE', 500, false);
        return Object.freeze(parsed.data);
      });
      return Object.freeze({
        id: message.messageId,
        turnId: message.turnId,
        role: message.role as AriaClientMessage['role'],
        content: message.content,
        status: message.status as AriaClientMessage['status'],
        citations: Object.freeze(citations),
        feedback: typeof message.feedback === 'boolean' ? message.feedback : null,
      });
    }));
    if (body.nextCursor === null || body.nextCursor === undefined) {
      if (!canonicalConversation) throw new AriaClientError('INVALID_RESPONSE', 500, false);
      return Object.freeze({
        messages: Object.freeze(pages.flat()),
        activeTurn: canonicalConversation.activeTurn
          ? Object.freeze(canonicalConversation.activeTurn)
          : null,
      });
    }
    if (typeof body.nextCursor !== 'string' || !body.nextCursor || seenCursors.has(body.nextCursor)) {
      throw new AriaClientError('INVALID_RESPONSE', 500, false);
    }
    seenCursors.add(body.nextCursor);
    cursor = body.nextCursor;
  }
  throw new AriaClientError('INVALID_RESPONSE', 500, false);
}

function waitForRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timeout = 0;
    const cleanup = () => signal.removeEventListener('abort', abort);
    const finish = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    timeout = window.setTimeout(finish, Math.min(2_000, Math.max(100, milliseconds)));
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function streamAriaConversation(
  request: AriaClientRequest,
  callbacks: AriaConversationTransportCallbacks,
  signal: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let response: Response;
    try {
      response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(request),
        signal,
      });
    } catch (error: unknown) {
      if (signal.aborted || !(error instanceof TypeError)) throw error;
      await waitForRetry(100, signal);
      continue;
    }
    if (response.status === 202) {
      const pending = ariaPendingResponseSchema.safeParse(await requireOk(response));
      if (!pending.success) throw new AriaClientError('INVALID_RESPONSE', 500, false);
      callbacks.onPending?.(Object.freeze(pending.data));
      await waitForRetry(pending.data.retryAfterMs, signal);
      continue;
    }
    if (!response.ok) {
      await requireOk(response);
      return;
    }
    try {
      await parseAriaSSEResponse(response, callbacks, { signal });
      return;
    } catch (error: unknown) {
      if (signal.aborted) throw error;
      if (error instanceof AriaSSEParseError) {
        if (error.code === 'TERMINAL_EVENT_MISSING') {
          await waitForRetry(100, signal);
          continue;
        }
        throw new AriaClientError('INVALID_RESPONSE', 502, false);
      }
      throw error;
    }
  }
  throw new AriaClientError('MODEL_UNAVAILABLE', 503, true);
}

export async function cancelAriaTurn(
  turnId: string,
  clientRequestId: string,
): Promise<AriaClientCancellation> {
  const body = await requireOk(await fetch(`/api/aria/turns/${encodeURIComponent(turnId)}/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientRequestId }),
  }));
  const parsed = ariaCancellationResponseSchema.safeParse(body);
  if (!parsed.success) throw new AriaClientError('INVALID_RESPONSE', 500, false);
  return Object.freeze(parsed.data);
}

export async function submitAriaFeedback(
  messageId: string,
  useful: boolean,
): Promise<AriaFeedbackResponse['feedback']> {
  const body = await requireOk(await fetch('/api/aria/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messageId, useful }),
  }));
  const parsed = ariaFeedbackResponseSchema.safeParse(body);
  if (!parsed.success) throw new AriaClientError('INVALID_RESPONSE', 500, false);
  return Object.freeze(parsed.data.feedback);
}
