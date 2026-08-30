import {
  cancelAriaTurn,
  createAriaClientRequest,
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
});
