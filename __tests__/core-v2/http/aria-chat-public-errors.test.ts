import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/core-v2/client', () => ({
  ...jest.requireActual('@/lib/core-v2/client'),
  requireCoreV2Client: jest.fn(),
}));
jest.mock('@/lib/core-v2/http/actor', () => ({ resolveActor: jest.fn() }));
jest.mock('@/lib/core-v2/aria/conversation-context', () => ({
  buildCoreV2AriaConversationContext: jest.fn(),
}));
jest.mock('@/lib/aria/application/conversation/execute', () => ({
  makeCanonicalAriaConversationExecutor: jest.fn(),
}));

import { auth } from '@/auth';
import { POST } from '@/app/api/v2/aria/chat/route';
import { NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import { CoreV2DatabaseIdentityError, CoreV2DatabaseUrlError, requireCoreV2Client } from '@/lib/core-v2/client';
import { CoreV2ConfigError } from '@/lib/core-v2/config';
import { resolveActor } from '@/lib/core-v2/http/actor';
import { buildCoreV2AriaConversationContext } from '@/lib/core-v2/aria/conversation-context';
import { makeCanonicalAriaConversationExecutor } from '@/lib/aria/application/conversation/execute';
import { AriaError, type AriaErrorCode } from '@/lib/aria/kernel/errors';
import { logger } from '@/lib/logger';

const requestId = 'aria-public-error-001';
const privateDetail = '/srv/private/student-prompt https://provider.invalid/v1 child@example.test postgresql://db.invalid/prod';
const privateStack = 'STACK_SECRET at /srv/private/aria-chat.ts';
const validBody = {
  clientRequestId: '00000000-0000-4000-8000-000000000001',
  courseKey: 'philosophie-terminale',
  content: 'Question pédagogique',
};

async function callChat(body: unknown = validBody) {
  const request = new NextRequest('http://localhost:3000/api/v2/aria/chat', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      'x-correlation-id': requestId,
    },
    body: JSON.stringify(body),
  });
  const response = await POST(request, NO_PARAMS);
  return { status: response.status, header: response.headers.get('x-correlation-id'), body: await response.json() };
}

function expectPublicError(
  result: Awaited<ReturnType<typeof callChat>>,
  status: number,
  code: string,
  retryable: boolean,
) {
  expect(result.status).toBe(status);
  expect(result.header).toBe(requestId);
  expect(result.body).toEqual({
    ok: false,
    error: {
      code,
      message: 'Requête ARIA impossible.',
      requestId,
      retryable,
    },
    correlationId: requestId,
  });
  expect(JSON.stringify(result.body)).not.toMatch(/\/srv\/private|provider\.invalid|child@example\.test|student-prompt|postgresql:\/\/|STACK_SECRET/);
}

describe('Core v2 chat public errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = 'true';
    process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED = 'true';
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', email: 'synthetic@example.test', role: 'ELEVE' },
      expires: '2099-01-01',
    });
    (requireCoreV2Client as jest.Mock).mockResolvedValue({});
    (resolveActor as jest.Mock).mockResolvedValue({ userId: 'student-user-1', role: 'ELEVE' });
    (buildCoreV2AriaConversationContext as jest.Mock).mockResolvedValue({ courseKey: validBody.courseKey });
  });

  afterEach(() => {
    delete process.env.CORE_V2_ARIA_CONVERSATION_ENABLED;
    delete process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED;
  });

  it.each([
    ['BAD_REQUEST', 400, 'BAD_REQUEST', false],
    ['NOT_ENTITLED', 403, 'NOT_ENTITLED', false],
    ['UNSUPPORTED', 422, 'UNSUPPORTED', false],
    ['CONVERSATION_BUSY', 409, 'CONVERSATION_BUSY', true],
    ['IDEMPOTENCY_CONFLICT', 409, 'IDEMPOTENCY_CONFLICT', false],
    ['CROSS_COURSE_MISMATCH', 400, 'BAD_REQUEST', false],
    ['RATE_LIMIT_EXCEEDED', 429, 'RATE_LIMIT_EXCEEDED', true],
    ['RATE_LIMIT_BACKEND_UNAVAILABLE', 503, 'RATE_LIMIT_BACKEND_UNAVAILABLE', true],
    ['RAG_UNAVAILABLE', 503, 'RAG_UNAVAILABLE', true],
    ['MODEL_TIMEOUT', 503, 'MODEL_UNAVAILABLE', true],
    ['MODEL_UNAVAILABLE', 503, 'MODEL_UNAVAILABLE', true],
    ['INTERNAL_ERROR', 500, 'INTERNAL_ERROR', false],
  ] as const)('serializes %s as %i/%s with retryable=%s', async (internalCode, status, code, retryable) => {
    (buildCoreV2AriaConversationContext as jest.Mock).mockRejectedValueOnce(
      new AriaError(internalCode as AriaErrorCode, 599, privateDetail, { reasonCode: 'SAFE_REASON', raw: privateDetail }),
    );
    expectPublicError(await callChat(), status, code, retryable);
    expect(makeCanonicalAriaConversationExecutor).not.toHaveBeenCalled();
  });

  it('uses the canonical provider error when execution returns an ERROR Turn', async () => {
    (makeCanonicalAriaConversationExecutor as jest.Mock).mockReturnValueOnce(jest.fn().mockResolvedValue({
      status: 'ERROR', failureCode: 'MODEL_UNAVAILABLE',
    }));
    expectPublicError(await callChat(), 503, 'MODEL_UNAVAILABLE', true);
  });

  it('opens an authenticated Core stream with its reserved identity before provider completion', async () => {
    let complete!: () => void;
    const waiting = new Promise<void>((resolve) => { complete = resolve; });
    (makeCanonicalAriaConversationExecutor as jest.Mock).mockReturnValueOnce(async (input: {
      onStart?: (event: unknown) => void;
    }) => {
      input.onStart?.({ turnId: 'turn-1', conversationId: 'conversation-1', messageId: 'message-1', status: 'RUNNING', disposition: 'EXECUTED' });
      await waiting;
      return { turnId: 'turn-1', conversationId: 'conversation-1', messageId: 'message-1', status: 'CANCELLED', disposition: 'EXECUTED', fullText: '', citations: [], ragStatus: 'NOT_CONFIGURED' };
    });
    const request = new NextRequest('http://localhost:3000/api/v2/aria/chat', {
      method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', accept: 'text/event-stream', 'x-correlation-id': requestId },
      body: JSON.stringify(validBody),
    });
    const pending = POST(request, NO_PARAMS);
    try {
      const response = await Promise.race([pending, new Promise<null>((resolve) => setTimeout(() => resolve(null), 100))]);
      expect(response).not.toBeNull();
      expect(response!.headers.get('content-type')).toContain('text/event-stream');
      expect(response!.headers.get('x-correlation-id')).toBe(requestId);
      const reader = response!.body!.getReader();
      const first = await reader.read();
      expect(new TextDecoder().decode(first.value)).toContain('"turnId":"turn-1"');
      expect(new TextDecoder().decode(first.value)).toContain('event: start');
      await reader.cancel();
    } finally {
      complete();
      await pending;
    }
  });

  it('maps malformed chat bodies to BAD_REQUEST without exposing validation details', async () => {
    expectPublicError(await callChat({ ...validBody, content: '' }), 400, 'BAD_REQUEST', false);
    expect(buildCoreV2AriaConversationContext).not.toHaveBeenCalled();
  });

  it('keeps a disabled chat refusal in the standard Core v2 envelope', async () => {
    process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = 'false';
    const result = await callChat();
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' }, correlationId: requestId });
    expect(buildCoreV2AriaConversationContext).not.toHaveBeenCalled();
  });

  it.each([
    [new CoreV2ConfigError('Core v2 configuration invalid.'), 'CORE_V2_MISCONFIGURED'],
    [new CoreV2DatabaseUrlError('Core v2 database URL invalid.'), 'CORE_V2_UNAVAILABLE'],
    [new CoreV2DatabaseIdentityError('Core v2 database identity invalid.'), 'CORE_V2_UNAVAILABLE'],
  ])('preserves the Core v2 503 boundary for %p', async (failure, code) => {
    (buildCoreV2AriaConversationContext as jest.Mock).mockRejectedValueOnce(failure);
    const result = await callChat();
    expect(result.status).toBe(503);
    expect(result.header).toBe(requestId);
    expect(result.body).toMatchObject({ ok: false, error: { code }, correlationId: requestId });
    expect(result.body.error).not.toHaveProperty('requestId');
    expect(result.body.error).not.toHaveProperty('retryable');
    expect(makeCanonicalAriaConversationExecutor).not.toHaveBeenCalled();
  });

  it('redacts adversarial ARIA error detail, metadata, and stack from response and logs', async () => {
    const log = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const failure = new AriaError('MODEL_UNAVAILABLE', 503, privateDetail, {
      reasonCode: 'SAFE_REASON', raw: privateDetail,
    });
    failure.stack = privateStack;
    (buildCoreV2AriaConversationContext as jest.Mock).mockRejectedValueOnce(failure);
    try {
      expectPublicError(await callChat(), 503, 'MODEL_UNAVAILABLE', true);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/postgresql:\/\/|provider\.invalid|student-prompt|child@example\.test|STACK_SECRET/);
    } finally {
      log.mockRestore();
    }
  });

  it('redacts unknown execution failures as INTERNAL_ERROR', async () => {
    const log = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const failure = new Error(privateDetail);
    failure.stack = privateStack;
    (makeCanonicalAriaConversationExecutor as jest.Mock).mockReturnValueOnce(jest.fn().mockRejectedValue(
      failure,
    ));
    try {
      expectPublicError(await callChat(), 500, 'INTERNAL_ERROR', false);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/postgresql:\/\/|provider\.invalid|student-prompt|child@example\.test|STACK_SECRET/);
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INTERNAL_ERROR', requestId }),
        'ARIA request failed',
      );
    } finally {
      log.mockRestore();
    }
  });
});
