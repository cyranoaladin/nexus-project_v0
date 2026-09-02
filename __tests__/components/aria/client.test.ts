import {
  AriaClientError,
  cancelAriaTurn,
  createAriaClientRequest,
  fetchAriaCurriculum,
  fetchLatestAriaConversation,
  fetchAriaConversationHistory,
  streamAriaConversation,
  submitAriaFeedback,
} from '@/lib/aria/client';
import { formatAriaSSEEvent } from '@/lib/aria/transport/sse-parser';

const request = createAriaClientRequest({
  courseKey: 'eds-nsi-terminale',
  content: 'Explique une pile.',
  conversationId: 'conversation-1',
}, () => 'd9428888-122b-4fd9-806c-02948637efeb');

function terminalStream(): Response {
  const body = [
    formatAriaSSEEvent({
      event: 'start',
      data: {
        turnId: 'turn-1',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        courseKey: 'eds-nsi-terminale',
        status: 'RUNNING',
        disposition: 'EXECUTED',
      },
    }),
    formatAriaSSEEvent({
      event: 'done',
      data: {
        turnId: 'turn-1',
        messageId: 'message-1',
        status: 'COMPLETED',
        fullText: 'Une pile suit le principe dernier entré, premier sorti.',
      },
    }),
  ].join('');
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

const activeHistoryTurn = {
  turnId: 'turn-active',
  clientRequestId: '00000000-0000-4000-8000-000000000001',
  status: 'RUNNING',
  pedagogicalMode: 'METHODOLOGY',
} as const;

function historyConversation(activeTurn: typeof activeHistoryTurn | null = null) {
  return {
    id: 'conversation-1', courseKey: 'eds-nsi-terminale',
    contextState: 'ACTIVE', resumable: true, activeTurn,
  };
}

describe('ARIA browser client transport ownership', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('creates a UUID idempotency key when randomUUID is unavailable in an HTTP browser context', () => {
    const originalCrypto = globalThis.crypto;
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues<T extends ArrayBufferView>(target: T): T {
          new Uint8Array(target.buffer, target.byteOffset, target.byteLength).set(bytes);
          return target;
        },
      },
    });

    try {
      expect(createAriaClientRequest({
        courseKey: 'eds-nsi-terminale',
        content: 'Explique une pile.',
        conversationId: null,
      }).clientRequestId).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
    }
  });

  it('uses native randomUUID when available and fails closed without browser cryptography', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => '31fe5f82-14ee-4b45-b03d-19d8f54f8606' },
    });
    expect(createAriaClientRequest({
      courseKey: 'eds-nsi-terminale', content: 'Question', conversationId: null,
    }).clientRequestId).toBe('31fe5f82-14ee-4b45-b03d-19d8f54f8606');

    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    expect(() => createAriaClientRequest({
      courseKey: 'eds-nsi-terminale', content: 'Question', conversationId: null,
    })).toThrow(expect.objectContaining({ code: 'CLIENT_CRYPTO_UNAVAILABLE' }));
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
  });

  it('CLIENT_REQUEST_PRESERVES_PEDAGOGICAL_MODE', () => {
    expect(createAriaClientRequest({
      courseKey: 'eds-nsi-terminale',
      content: 'Explique la méthode.',
      conversationId: null,
      pedagogicalMode: 'METHODOLOGY',
    }, () => '00000000-0000-4000-8000-000000000010')).toEqual({
      clientRequestId: '00000000-0000-4000-8000-000000000010',
      courseKey: 'eds-nsi-terminale',
      content: 'Explique la méthode.',
      pedagogicalMode: 'METHODOLOGY',
    });
  });

  it.each(['PENDING', 'RUNNING'] as const)(
    'retries a %s 202 reservation with the exact same immutable idempotent payload',
    async (status) => {
    const pendingEvent = {
      turnId: 'turn-1', status, disposition: 'IN_PROGRESS', retryAfterMs: 1,
    };
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(pendingEvent), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(terminalStream());
    const done = jest.fn();
    const onPending = jest.fn();

    await streamAriaConversation(request, { onDone: done, onPending }, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(request));
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify(request));
    expect(onPending).toHaveBeenCalledWith(pendingEvent);
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
    },
  );

  it.each([
    {},
    { turnId: '', status: 'RUNNING', disposition: 'IN_PROGRESS', retryAfterMs: 1 },
    { turnId: 'turn-1', status: 'COMPLETED', disposition: 'IN_PROGRESS', retryAfterMs: 1 },
    { turnId: 'turn-1', status: 'RUNNING', disposition: 'REPLAY', retryAfterMs: 1 },
    { turnId: 'turn-1', status: 'RUNNING', disposition: 'IN_PROGRESS', retryAfterMs: -1 },
    { turnId: 'turn-1', status: 'RUNNING', disposition: 'IN_PROGRESS', retryAfterMs: 1, extra: true },
  ])('rejects an invalid pending reservation response %#', async (body) => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(body), {
      status: 202, headers: { 'content-type': 'application/json' },
    }));
    await expect(streamAriaConversation(request, {}, new AbortController().signal))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('U030 ARIA-B-R067 reconnects an interrupted SSE execution with the exact same clientRequestId', async () => {
    const interrupted = new Response([
      formatAriaSSEEvent({
        event: 'start',
        data: {
          turnId: 'turn-1', conversationId: 'conversation-1', messageId: 'message-1',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
        },
      }),
      formatAriaSSEEvent({ event: 'delta', data: { text: 'Une pile ' } }),
    ].join(''), { headers: { 'content-type': 'text/event-stream' } });
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(interrupted)
      .mockResolvedValueOnce(terminalStream());
    const done = jest.fn();

    await streamAriaConversation(request, { onDone: done }, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(request));
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify(request));
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('uses the explicit cancellation command with the same clientRequestId', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        turnId: 'turn-1', conversationId: 'conversation-1', status: 'CANCELLED',
        disposition: 'CANCELLED',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(cancelAriaTurn('turn-1', request.clientRequestId)).resolves.toEqual({
      turnId: 'turn-1', conversationId: 'conversation-1', status: 'CANCELLED',
      disposition: 'CANCELLED',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/aria/turns/turn-1/cancel', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ clientRequestId: request.clientRequestId }),
    }));
  });

  it.each([
    {},
    { turnId: 'turn-1', conversationId: 'conversation-1', status: 'RUNNING', disposition: 'CANCELLED' },
    { turnId: 'turn-1', conversationId: 'conversation-1', status: 'CANCELLED', disposition: 'CANCELLED', extra: true },
  ])('rejects an invalid cancellation response %#', async (body) => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(body), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    await expect(cancelAriaTurn('turn-1', request.clientRequestId))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('CURRICULUM_CLIENT_VALIDATES_V1_PROFILE and returns every canonical preference', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      courses: [{
        courseKey: 'eds-nsi-terminale',
        label: 'NSI',
        capabilities: { hasChat: true },
        access: { status: 'AVAILABLE', commerciallyEntitled: true },
      }],
      profile: {
        version: 1,
        pinnedCourseKeys: ['eds-nsi-terminale'],
        focusedCourseKey: 'eds-nsi-terminale',
        courseOrder: ['eds-nsi-terminale'],
        showCitations: false,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(fetchAriaCurriculum()).resolves.toEqual({
      courses: [expect.objectContaining({ courseKey: 'eds-nsi-terminale' })],
      profile: {
        version: 1,
        pinnedCourseKeys: ['eds-nsi-terminale'],
        focusedCourseKey: 'eds-nsi-terminale',
        courseOrder: ['eds-nsi-terminale'],
        showCitations: false,
      },
    });
  });

  it.each([
    { pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [], showCitations: true },
    { version: 2, pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [], showCitations: true },
    { version: 1, pinnedCourseKeys: ['unknown-course'], focusedCourseKey: null, courseOrder: [], showCitations: true },
  ])('rejects malformed or course-incoherent curriculum profile %#', async (profile) => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      courses: [{
        courseKey: 'eds-nsi-terminale',
        label: 'NSI',
        capabilities: { hasChat: true },
        access: { status: 'AVAILABLE', commerciallyEntitled: true },
      }],
      profile,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(fetchAriaCurriculum()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([
    {},
    { courses: null, profile: {} },
    { courses: [null], profile: {} },
    { courses: [{ courseKey: 1, label: 'NSI', capabilities: {}, access: {} }], profile: {} },
    {
      courses: [{
        courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
        access: { status: 'BROKEN', commerciallyEntitled: true },
      }],
      profile: { version: 1, pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [], showCitations: true },
    },
  ])('fails closed on malformed curriculum payload %#', async (payload) => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    await expect(fetchAriaCurriculum()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('normalizes an absent or non-string curriculum lock reason to null', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      courses: [{
        courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
        access: { status: 'AVAILABLE', commerciallyEntitled: true, lockReason: 12 },
      }],
      profile: { version: 1, pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [], showCitations: true },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(fetchAriaCurriculum()).resolves.toMatchObject({
      courses: [expect.objectContaining({ access: expect.objectContaining({ lockReason: null }) })],
    });
  });

  it('preserves a canonical string curriculum lock reason', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      courses: [{
        courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
        access: { status: 'LOCKED', commerciallyEntitled: false, lockReason: 'NOT_ENTITLED' },
      }],
      profile: { version: 1, pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [], showCitations: true },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(fetchAriaCurriculum()).resolves.toMatchObject({
      courses: [expect.objectContaining({
        access: expect.objectContaining({ lockReason: 'NOT_ENTITLED' }),
      })],
    });
  });

  it.each([
    [{ conversations: [] }, null],
    [{ conversations: [{ id: 'conversation-1', resumable: true }] }, 'conversation-1'],
    [{ conversations: [{ id: 'conversation-1', resumable: false }] }, null],
    [{ conversations: [{ id: 3, resumable: true }] }, null],
  ])('validates latest conversation response %#', async (payload, expected) => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    const signal = new AbortController().signal;
    await expect(fetchLatestAriaConversation('eds nsi/terminale', signal)).resolves.toBe(expected);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/aria/conversations?courseKey=eds%20nsi%2Fterminale&limit=1',
      { signal },
    );
  });

  it('rejects malformed latest-conversation envelopes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ conversations: 'bad' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    await expect(fetchLatestAriaConversation('eds-nsi-terminale')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('loads every history page and restores chronological order across newest-first pages', async () => {
    const message = (id: string, content: string) => ({
      messageId: id,
      turnId: id === 'message-4' ? 'turn-active' : null,
      role: 'assistant',
      content,
      status: 'COMPLETED',
      citations: [],
      feedback: null,
    });
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversation: historyConversation(activeHistoryTurn),
        messages: [message('message-3', 'troisième'), message('message-4', 'quatrième')],
        nextCursor: 'older-cursor',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversation: historyConversation(activeHistoryTurn),
        messages: [message('message-1', 'première'), message('message-2', 'deuxième')],
        nextCursor: null,
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const controller = new AbortController();

    const history = await fetchAriaConversationHistory('conversation-1', controller.signal);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/aria/conversations/conversation-1/messages?limit=50',
      { signal: controller.signal },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/aria/conversations/conversation-1/messages?limit=50&cursor=older-cursor',
      { signal: controller.signal },
    );
    expect(history.messages.map(({ id }) => id)).toEqual([
      'message-1', 'message-2', 'message-3', 'message-4',
    ]);
    expect(history.activeTurn).toEqual(activeHistoryTurn);
    expect(history.messages[3]).toMatchObject({ turnId: 'turn-active' });
  });

  it('returns inactive history and preserves the canonical boolean feedback value', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      conversation: historyConversation(null),
      messages: [{
        messageId: 'assistant-feedback',
        turnId: null,
        role: 'assistant',
        content: 'Réponse',
        status: 'COMPLETED',
        citations: [],
        feedback: false,
      }],
      nextCursor: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(fetchAriaConversationHistory('conversation-1')).resolves.toEqual({
      messages: [expect.objectContaining({ id: 'assistant-feedback', feedback: false })],
      activeTurn: null,
    });
  });

  it('rejects a history response for a different conversation identity', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      conversation: { ...historyConversation(), id: 'conversation-other' },
      messages: [],
      nextCursor: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(fetchAriaConversationHistory('conversation-1')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('rejects course identity drift between history pages', async () => {
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversation: historyConversation(), messages: [], nextCursor: 'older',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversation: { ...historyConversation(), courseKey: 'eds-maths-premiere' },
        messages: [],
        nextCursor: null,
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(fetchAriaConversationHistory('conversation-1')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('rejects a malformed history citation instead of casting arbitrary JSON', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      conversation: historyConversation(),
      messages: [{
        messageId: 'message-invalid-citation',
        turnId: null,
        role: 'assistant',
        content: 'Réponse',
        status: 'COMPLETED',
        citations: [{
          traceability: 'CANONICAL',
          id: 'citation-1',
          sourceTitle: 'Programme',
          sourceDocument: 'programme.pdf',
          sourceLocation: null,
          courseKey: 'eds-maths-premiere',
          provenance: 'OFFICIEL_MEN',
          url: null,
          resourceId: 'resource-1',
          resourceVersionId: 'version-1',
          contentSha256: 'not-a-sha256',
          chunkId: 'chunk-1',
          locator: { page: 2 },
          corpusId: 'maths-premiere',
          corpusVersionId: 'corpus-version-1',
          manifestSha256: 'b'.repeat(64),
        }],
        feedback: null,
      }],
      nextCursor: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(fetchAriaConversationHistory('conversation-1')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it.each([
    { messages: null, nextCursor: null },
    { messages: [null], nextCursor: null },
    {
      messages: [{
        messageId: 'm1', role: 'intruder', content: 'x', status: 'COMPLETED', citations: [],
      }], nextCursor: null,
    },
    { messages: [], nextCursor: 12 },
    { messages: [], nextCursor: '' },
  ])('rejects malformed history payload %#', async (payload) => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      conversation: historyConversation(),
      ...payload,
    }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    await expect(fetchAriaConversationHistory('conversation-1')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('rejects a repeated history cursor and bounds pagination', async () => {
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversation: historyConversation(), messages: [], nextCursor: 'repeat',
      }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversation: historyConversation(), messages: [], nextCursor: 'repeat',
      }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    await expect(fetchAriaConversationHistory('conversation-1')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    jest.restoreAllMocks();
    let page = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      page += 1;
      return new Response(JSON.stringify({
        conversation: { ...historyConversation(), id: 'conversation-2' },
        messages: [], nextCursor: `cursor-${page}`,
      }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    });
    await expect(fetchAriaConversationHistory('conversation-2', new AbortController().signal)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('maps invalid JSON and stable public error envelopes without leaking server detail', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('not-json', { status: 502 }));
    await expect(fetchLatestAriaConversation('eds-nsi-terminale')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE', status: 502, retryable: false,
    });

    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'NOT_ENTITLED', retryable: true, private: '/srv/secret' },
    }), { status: 403, headers: { 'content-type': 'application/json' } }));
    await expect(fetchLatestAriaConversation('eds-nsi-terminale')).rejects.toMatchObject({
      code: 'NOT_ENTITLED', status: 403, retryable: true,
    });

    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: {} }), {
      status: 500, headers: { 'content-type': 'application/json' },
    }));
    await expect(fetchLatestAriaConversation('eds-nsi-terminale')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR', status: 500, retryable: false,
    });
  });

  it('normalizes an invalid JSON response with status zero to a stable 500', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      status: 0,
      ok: false,
      json: jest.fn().mockRejectedValue(new SyntaxError('invalid fixture JSON')),
    } as unknown as Response);

    await expect(fetchLatestAriaConversation('eds-nsi-terminale')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE', status: 500, retryable: false,
    });
  });

  it('rejects non-object public envelopes', async () => {
    for (const payload of [null, [], { error: null }]) {
      jest.restoreAllMocks();
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(payload), {
        status: 500, headers: { 'content-type': 'application/json' },
      }));
      await expect(fetchLatestAriaConversation('eds-nsi-terminale')).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    }
  });

  it('propagates cancellation and non-network transport failures without retry', async () => {
    const aborted = new AbortController();
    aborted.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(abortError);
    await expect(streamAriaConversation(request, {}, aborted.signal)).rejects.toBe(abortError);

    jest.restoreAllMocks();
    const providerError = new Error('fixture transport failure');
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(providerError);
    await expect(streamAriaConversation(request, {}, new AbortController().signal))
      .rejects.toBe(providerError);
  });

  it('aborts while waiting to retry a transient network error', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('network'));
    const promise = streamAriaConversation(request, {}, controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    jest.useRealTimers();
  });

  it('rejects non-success chat responses through the stable public error envelope', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'CONVERSATION_BUSY', retryable: true },
    }), { status: 409, headers: { 'content-type': 'application/json' } }));
    await expect(streamAriaConversation(request, {}, new AbortController().signal))
      .rejects.toMatchObject({ code: 'CONVERSATION_BUSY', status: 409 });
  });

  it('normalizes malformed SSE to a stable client error and preserves abort during parsing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('event: unknown\ndata: {}\n\n', {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    }));
    await expect(streamAriaConversation(request, {}, new AbortController().signal))
      .rejects.toMatchObject({
        name: 'AriaClientError', code: 'INVALID_RESPONSE', status: 502, retryable: false,
      });

    jest.restoreAllMocks();
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start() {
        controller.abort();
      },
    });
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(stream, {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    }));
    await expect(streamAriaConversation(request, {}, controller.signal)).rejects.toMatchObject({
      name: 'AriaSSEParseError', code: 'ABORTED',
    });
  });

  it('normalizes a callback identity rejection through the real SSE parser', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response([
      'event: start',
      `data: ${JSON.stringify({
        turnId: 'turn-callback', conversationId: 'conversation-callback',
        messageId: 'assistant-callback', courseKey: 'eds-nsi-terminale',
        status: 'RUNNING', disposition: 'EXECUTED',
      })}`,
      '',
      'event: done',
      `data: ${JSON.stringify({
        turnId: 'turn-callback', messageId: 'assistant-callback',
        status: 'COMPLETED', fullText: 'Réponse',
      })}`,
      '',
    ].join('\n'), {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    }));

    await expect(streamAriaConversation(request, {
      onStart() {
        throw new AriaClientError('INVALID_RESPONSE', 500, false);
      },
    }, new AbortController().signal)).rejects.toMatchObject({
      name: 'AriaClientError', code: 'INVALID_RESPONSE', status: 502, retryable: false,
    });
  });

  it('fails after the bounded number of pending reservations', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(
      JSON.stringify({
        turnId: 'turn-pending', status: 'RUNNING', disposition: 'IN_PROGRESS', retryAfterMs: 100,
      }),
      { status: 202, headers: { 'content-type': 'application/json' } },
    ));
    const pending = streamAriaConversation(request, {}, new AbortController().signal);
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'MODEL_UNAVAILABLE', retryable: true,
    });
    await jest.runAllTimersAsync();
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(30);
    jest.useRealTimers();
  });

  it('persists feedback through the single browser feedback endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      feedback: {
        id: 'feedback-1', useful: true, reason: null, updatedAt: '2026-08-31T00:00:00.000Z',
      },
      newBadges: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(submitAriaFeedback('message/id', false)).resolves.toEqual({
      id: 'feedback-1', useful: true, reason: null, updatedAt: '2026-08-31T00:00:00.000Z',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/aria/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageId: 'message/id', useful: false }),
    });
  });

  it.each([
    { data: { useful: false } },
    { success: true, feedback: { id: 'feedback-1', useful: false, reason: null, updatedAt: 'invalid' }, newBadges: [] },
    { success: true, feedback: { id: 'feedback-1', useful: false, reason: null, updatedAt: '2026-08-31T00:00:00.000Z' }, newBadges: [], extra: true },
  ])('rejects malformed feedback persistence response %#', async (body) => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(body), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    await expect(submitAriaFeedback('message/id', false))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('constructs opaque browser errors without embedding provider details', () => {
    const error = new AriaClientError('MODEL_UNAVAILABLE', 503, true);
    expect(error).toMatchObject({
      name: 'AriaClientError', message: 'ARIA_CLIENT_ERROR:MODEL_UNAVAILABLE',
      status: 503, retryable: true,
    });
  });
});
