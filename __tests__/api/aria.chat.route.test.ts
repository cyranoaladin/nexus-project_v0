import { auth } from '@/auth';
import { POST } from '@/app/api/aria/chat/route';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { executeAriaConversationJson } from '@/lib/aria/transport/json';
import { prepareAriaSSEConversation } from '@/lib/aria/transport/sse';
import { AriaError } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/aria/application/conversation/public', () => ({
  buildAriaConversationContext: jest.fn(),
}));

jest.mock('@/lib/aria/transport/json', () => ({ executeAriaConversationJson: jest.fn() }));
jest.mock('@/lib/aria/transport/sse', () => ({ prepareAriaSSEConversation: jest.fn() }));

jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn(),
}));

jest.mock('@/lib/middleware/logger', () => ({
  createLogger: jest.fn(),
}));

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/aria/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/aria/chat', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body,
  });
}

describe('POST /api/aria/chat', () => {
  const clientRequestId = '00000000-0000-4000-8000-000000000001';
  const context = {
    courseKey: 'eds-maths-terminale',
    conversation: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createLogger as jest.Mock).mockReturnValue({
      logSecurityEvent: jest.fn(),
      logRequest: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getRequestId: jest.fn(() => 'request-1'),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatchObject({ code: 'UNAUTHORIZED', retryable: false });
  });

  it('returns 401 when role is not ELEVE', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatchObject({ code: 'UNAUTHORIZED', retryable: false });
  });

  it('A011 ARIA-B-R050 returns 400 for invalid payload shape', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });

    const response = await POST(makeRequest({ courseKey: 'unknown-course' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual({ code: 'BAD_REQUEST', requestId: 'request-1', retryable: false });
  });

  it('ARIA-B-R009 rejects the removed subject chat payload before context resolution', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    const response = await POST(makeRequest({
      subject: 'MATHEMATIQUES', clientRequestId, content: 'Question',
    }));
    expect(response.status).toBe(400);
    expect(buildAriaConversationContext).not.toHaveBeenCalled();
  });

  it('rejects a client-controlled resource version before context resolution', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    const response = await POST(makeRequest({
      courseKey: 'eds-maths-terminale',
      clientRequestId,
      content: 'Question',
      resourceVersionId: 'forged-resource-version',
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'BAD_REQUEST', requestId: 'request-1', retryable: false },
    });
    expect(buildAriaConversationContext).not.toHaveBeenCalled();
    expect(executeAriaConversationJson).not.toHaveBeenCalled();
    expect(prepareAriaSSEConversation).not.toHaveBeenCalled();
  });

  it('A019 ARIA-B-R091 returns stable BAD_REQUEST for malformed JSON', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    const response = await POST(makeRawRequest('{"provider-like":'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'BAD_REQUEST', requestId: 'request-1', retryable: false },
    });
  });

  it('fails closed when authentication infrastructure is unavailable', async () => {
    (auth as jest.Mock).mockRejectedValue(new Error('/private/path auth provider unavailable'));

    const response = await POST(makeRequest({
      courseKey: 'eds-maths-terminale', clientRequestId, content: 'Bonjour',
    }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', requestId: 'request-1', retryable: false },
    });
    expect(JSON.stringify(body)).not.toContain('/private/path');
  });

  it('ARIA-B-R093 returns stable NOT_ENROLLED without exposing the internal message', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockRejectedValue(
      new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable.')
    );

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({ code: 'NOT_ENROLLED', retryable: false });
    expect(JSON.stringify(body)).not.toContain('Profil élève introuvable');
  });

  it('A020 rejects invalid message and payload bounds before context resolution', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });

    const oversizedBody = await POST(makeRawRequest('x'.repeat(8_193), {
      'content-length': '1',
    }));
    expect(oversizedBody.status).toBe(413);
    await expect(oversizedBody.json()).resolves.toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', requestId: 'request-1', retryable: false },
    });

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: '   ' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual({ code: 'BAD_REQUEST', requestId: 'request-1', retryable: false });

    const oversized = await POST(makeRequest({
      courseKey: 'eds-maths-terminale', clientRequestId, content: 'x'.repeat(1_501),
    }));
    expect(oversized.status).toBe(400);
    expect(buildAriaConversationContext).not.toHaveBeenCalled();
  });

  it('A005 ARIA-B-R027 returns 200 with conversation and message on success via unified pipeline', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);

    (executeAriaConversationJson as jest.Mock).mockResolvedValue({
      success: true,
      conversation: { id: 'conv-1', courseKey: 'eds-maths-terminale' },
      turn: { id: 'turn-1', status: 'COMPLETED', disposition: 'EXECUTED' },
      message: { id: 'msg-1', content: 'Voici la reponse', citations: [] },
      metadata: {
        turnId: 'turn-1', courseKey: 'eds-maths-terminale',
        status: 'COMPLETED', disposition: 'EXECUTED', ragStatus: 'SUCCESS',
      },
    });

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: 'Salut' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.conversation.id).toBe('conv-1');
    expect(body.message.id).toBe('msg-1');
    expect(executeAriaConversationJson).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        message: 'Salut',
      })
    );
    expect(buildAriaConversationContext).toHaveBeenCalledWith({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      skillId: undefined,
      resourceId: undefined,
      conversationId: undefined,
    });
  });

  it('A013 returns 202 for the same idempotent request while its Turn remains active', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (executeAriaConversationJson as jest.Mock).mockResolvedValue({
      success: true,
      conversation: { id: 'conv-1', courseKey: context.courseKey },
      turn: { id: 'turn-1', status: 'RUNNING', disposition: 'IN_PROGRESS' },
      message: { id: 'msg-1', content: '', citations: [] },
      metadata: {
        turnId: 'turn-1', courseKey: context.courseKey,
        status: 'RUNNING', disposition: 'IN_PROGRESS',
      },
    });

    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Même requête',
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      turn: { id: 'turn-1', status: 'RUNNING', disposition: 'IN_PROGRESS' },
    });
  });

  it('returns the canonical SSE stream only after reservation and context checks succeed', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.close(); },
    });
    (prepareAriaSSEConversation as jest.Mock).mockResolvedValue({ kind: 'STREAM', stream });

    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Stream',
    }, { Accept: 'text/event-stream' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(prepareAriaSSEConversation).toHaveBeenCalledWith(expect.objectContaining({
      executionInput: expect.objectContaining({ context, message: 'Stream' }),
      requestId: 'request-1',
    }));
  });

  it('returns 202 JSON instead of opening SSE for an already-running idempotent Turn', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (prepareAriaSSEConversation as jest.Mock).mockResolvedValue({
      kind: 'IN_PROGRESS',
      result: {
        turnId: 'turn-running', conversationId: 'conv-1', messageId: 'msg-1',
        status: 'RUNNING', disposition: 'IN_PROGRESS', fullText: '', citations: [],
      },
    });

    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Stream',
    }, { Accept: 'text/event-stream' }));
    expect(response.status).toBe(202);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      turnId: 'turn-running', status: 'RUNNING', disposition: 'IN_PROGRESS', retryAfterMs: 1_000,
    });
  });

  it('returns 202 when the same idempotent Turn is reserved but not yet claimed', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (prepareAriaSSEConversation as jest.Mock).mockResolvedValue({
      kind: 'IN_PROGRESS',
      result: {
        turnId: 'turn-pending', conversationId: 'conv-1', messageId: 'msg-1',
        status: 'PENDING', disposition: 'IN_PROGRESS', fullText: '', citations: [],
      },
    });

    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Stream',
    }, { Accept: 'text/event-stream' }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      turnId: 'turn-pending', status: 'PENDING', disposition: 'IN_PROGRESS', retryAfterMs: 1_000,
    });
  });

  it('classifies an invalid internal pending projection as INTERNAL_ERROR', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (prepareAriaSSEConversation as jest.Mock).mockResolvedValue({
      kind: 'IN_PROGRESS',
      result: {
        turnId: 'turn-invalid', conversationId: 'conv-1', messageId: 'msg-1',
        status: 'COMPLETED', disposition: 'IN_PROGRESS', fullText: '', citations: [],
      },
    });
    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Stream',
    }, { Accept: 'text/event-stream' }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });

  it('A010 ARIA-B-R096 returns 404 when conversation is not found or belongs to another student', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-2-user', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockRejectedValue(
      new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation introuvable.')
    );

    const response = await POST(makeRequest({
      conversationId: 'student-1-conversation',
      courseKey: 'eds-maths-terminale',
      clientRequestId,
      content: 'Continue la conversation',
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({ code: 'CONVERSATION_NOT_FOUND', retryable: false });
    expect(executeAriaConversationJson).not.toHaveBeenCalled();
  });

  it('A015 returns stable 409 when a different request already owns the conversation execution slot', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (executeAriaConversationJson as jest.Mock).mockRejectedValue(
      new AriaError('CONVERSATION_BUSY', 409, 'active turn token=/private/secret'),
    );

    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Autre requête',
    }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: 'CONVERSATION_BUSY', requestId: 'request-1', retryable: true },
    });
    expect(JSON.stringify(body)).not.toContain('/private/secret');
  });

  it.each([
    ['A003 ARIA-B-R095', 'UNSUPPORTED', 422],
    ['A004 ARIA-B-R094', 'NOT_ENTITLED', 403],
    ['A007', 'NOT_ENTITLED', 403],
  ] as const)('%s maps %s access denial before transport execution', async (_id, code, status) => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockRejectedValue(
      new AriaError(code, status, 'sensitive entitlement detail'),
    );

    const response = await POST(makeRequest({
      courseKey: 'eds-maths-terminale', clientRequestId, content: 'Question',
    }));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: { code, requestId: 'request-1', retryable: false },
    });
    expect(executeAriaConversationJson).not.toHaveBeenCalled();
  });

  it('A014 ARIA-B-R058 returns the canonical idempotency conflict without leaking its fingerprint', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (executeAriaConversationJson as jest.Mock).mockRejectedValue(
      new AriaError('CONVERSATION_BUSY', 409, 'fingerprint=private-request-material'),
    );
    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Payload différent',
    }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toEqual({ code: 'CONVERSATION_BUSY', requestId: 'request-1', retryable: true });
    expect(JSON.stringify(body)).not.toContain('fingerprint');
  });

  it('ARIA-B-R055 rejects an absent clientRequestId', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    const response = await POST(makeRequest({
      courseKey: 'eds-maths-terminale', content: 'Question',
    }));
    expect(response.status).toBe(400);
    expect(buildAriaConversationContext).not.toHaveBeenCalled();
  });

  it('ARIA-B-R056 rejects a non-UUID clientRequestId', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    const response = await POST(makeRequest({
      courseKey: 'eds-maths-terminale', clientRequestId: 'server-default', content: 'Question',
    }));
    expect(response.status).toBe(400);
    expect(buildAriaConversationContext).not.toHaveBeenCalled();
  });

  it.each([
    ['ARIA-B-R097', 'RAG_UNAVAILABLE', 503, true],
    ['ARIA-B-R098', 'MODEL_UNAVAILABLE', 503, true],
    ['ARIA-B-R099', 'INTERNAL_ERROR', 500, false],
    ['ARIA-B-RATE-JSON-DENIED', 'RATE_LIMIT_EXCEEDED', 429, true],
    ['ARIA-B-RATE-JSON-UNAVAILABLE', 'RATE_LIMIT_BACKEND_UNAVAILABLE', 503, true],
  ] as const)('%s returns a stable redacted JSON error for %s', async (_id, code, status, retryable) => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (executeAriaConversationJson as jest.Mock).mockRejectedValue(
      new AriaError(code, status, 'provider internal detail'),
    );
    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Question',
    }));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: { code, requestId: 'request-1', retryable },
    });
  });

  it.each([
    ['RATE_LIMIT_EXCEEDED', 429],
    ['RATE_LIMIT_BACKEND_UNAVAILABLE', 503],
  ] as const)('keeps SSE admission failure %s before stream start', async (code, status) => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (prepareAriaSSEConversation as jest.Mock).mockRejectedValue(
      new AriaError(code, status, 'redis://private:secret@internal:6379'),
    );

    const response = await POST(makeRequest({
      courseKey: context.courseKey, clientRequestId, content: 'Question',
    }, { Accept: 'text/event-stream' }));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: { code, requestId: 'request-1', retryable: true },
    });
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
