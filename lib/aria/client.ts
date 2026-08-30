'use client';

import type { AriaSSECallbacks } from './transport/sse-parser';
import { parseAriaSSEResponse } from './transport/sse-parser';

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
  readonly [key: string]: unknown;
}

export interface AriaClientMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly status: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
  readonly citations: readonly AriaClientCitation[];
  readonly feedback: boolean | null;
}

export interface AriaClientRequest {
  readonly clientRequestId: string;
  readonly courseKey: string;
  readonly content: string;
  readonly conversationId?: string;
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
  input: Readonly<{ courseKey: string; content: string; conversationId: string | null }>,
  createId: () => string = () => crypto.randomUUID(),
): AriaClientRequest {
  return Object.freeze({
    clientRequestId: createId(),
    courseKey: input.courseKey,
    content: input.content,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
  });
}

export async function fetchAriaCurriculum(signal?: AbortSignal): Promise<{
  readonly courses: readonly AriaClientCourse[];
  readonly focusedCourseKey: string | null;
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
  const profile = object(body.profile);
  return Object.freeze({
    courses: Object.freeze(courses),
    focusedCourseKey: typeof profile.focusedCourseKey === 'string' ? profile.focusedCourseKey : null,
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

export async function fetchAriaMessages(
  conversationId: string,
  signal?: AbortSignal,
): Promise<readonly AriaClientMessage[]> {
  const response = await fetch(
    `/api/aria/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`,
    { signal },
  );
  const body = object(await requireOk(response));
  if (!Array.isArray(body.messages)) throw new AriaClientError('INVALID_RESPONSE', 500, false);
  return Object.freeze(body.messages.map((raw) => {
    const message = object(raw);
    if (typeof message.messageId !== 'string' || typeof message.content !== 'string'
      || !['user', 'assistant', 'system'].includes(String(message.role))
      || !['PENDING', 'STREAMING', 'COMPLETED', 'CANCELLED', 'ERROR'].includes(String(message.status))
      || !Array.isArray(message.citations)) {
      throw new AriaClientError('INVALID_RESPONSE', 500, false);
    }
    return Object.freeze({
      id: message.messageId,
      role: message.role as AriaClientMessage['role'],
      content: message.content,
      status: message.status as AriaClientMessage['status'],
      citations: Object.freeze(message.citations as AriaClientCitation[]),
      feedback: typeof message.feedback === 'boolean' ? message.feedback : null,
    });
  }));
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
  callbacks: AriaSSECallbacks,
  signal: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch('/api/aria/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal,
    });
    if (response.status === 202) {
      const pending = object(await requireOk(response));
      await waitForRetry(typeof pending.retryAfterMs === 'number' ? pending.retryAfterMs : 1_000, signal);
      continue;
    }
    if (!response.ok) {
      await requireOk(response);
      return;
    }
    await parseAriaSSEResponse(response, callbacks, { signal });
    return;
  }
  throw new AriaClientError('MODEL_UNAVAILABLE', 503, true);
}

export async function cancelAriaTurn(
  turnId: string,
  clientRequestId: string,
): Promise<void> {
  await requireOk(await fetch(`/api/aria/turns/${encodeURIComponent(turnId)}/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientRequestId }),
  }));
}

export async function submitAriaFeedback(messageId: string, useful: boolean): Promise<void> {
  await requireOk(await fetch('/api/aria/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messageId, useful }),
  }));
}
