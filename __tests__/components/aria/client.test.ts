import {
  cancelAriaTurn,
  createAriaClientRequest,
  fetchAriaMessages,
  streamAriaConversation,
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

  it('retries a 202 reservation with the exact same immutable idempotent payload', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ retryAfterMs: 1 }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(terminalStream());
    const done = jest.fn();

    await streamAriaConversation(request, { onDone: done }, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(request));
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify(request));
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
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
      new Response(JSON.stringify({ data: { status: 'CANCELLED' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await cancelAriaTurn('turn-1', request.clientRequestId);

    expect(fetchMock).toHaveBeenCalledWith('/api/aria/turns/turn-1/cancel', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ clientRequestId: request.clientRequestId }),
    }));
  });

  it('loads every history page and restores chronological order across newest-first pages', async () => {
    const message = (id: string, content: string) => ({
      messageId: id,
      role: 'assistant',
      content,
      status: 'COMPLETED',
      citations: [],
      feedback: null,
    });
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        messages: [message('message-3', 'troisième'), message('message-4', 'quatrième')],
        nextCursor: 'older-cursor',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        messages: [message('message-1', 'première'), message('message-2', 'deuxième')],
        nextCursor: null,
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const controller = new AbortController();

    const history = await fetchAriaMessages('conversation-1', controller.signal);

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
    expect(history.map(({ id }) => id)).toEqual([
      'message-1', 'message-2', 'message-3', 'message-4',
    ]);
  });

  it('rejects a malformed history citation instead of casting arbitrary JSON', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      messages: [{
        messageId: 'message-invalid-citation',
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

    await expect(fetchAriaMessages('conversation-1')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
