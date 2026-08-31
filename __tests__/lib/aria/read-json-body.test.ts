import { ARIA_PERFORMANCE_BUDGETS } from '@/lib/aria/domain/observability/performance-budgets';
import { readBoundedAriaJson } from '@/lib/aria/transport/read-json-body';

const limit = ARIA_PERFORMANCE_BUDGETS.mutationBytesMax;

function requestWithBytes(bytes: Uint8Array, headers: HeadersInit = {}): Request {
  return new Request('http://localhost/api/aria/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: bytes as BodyInit,
  });
}

describe('bounded ARIA JSON mutation reader', () => {
  it('accepts an exact-byte-limit JSON body including fragmented UTF-8', async () => {
    const body = JSON.stringify({ value: 'é'.repeat((limit - 12) / 2) });
    const bytes = new TextEncoder().encode(body);
    expect(bytes).toHaveLength(limit);

    const split = bytes.indexOf(0xc3) + 1;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/aria/test', {
      method: 'POST', body: stream, duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    await expect(readBoundedAriaJson(request)).resolves.toEqual({
      value: 'é'.repeat((limit - 12) / 2),
    });
  });

  it('rejects an oversized declared Content-Length before reading the body', async () => {
    const request = requestWithBytes(new TextEncoder().encode('{}'), {
      'content-length': String(limit + 1),
    });
    await expect(readBoundedAriaJson(request)).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE', status: 413,
    });
  });

  it('rejects and cancels a chunked body once observed bytes exceed the limit', async () => {
    const cancel = jest.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(limit + 1)); },
      cancel,
    });
    const request = new Request('http://localhost/api/aria/test', {
      method: 'POST', body: stream, duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    await expect(readBoundedAriaJson(request)).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE', status: 413,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('uses observed bytes when Content-Length is understated', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ value: 'x'.repeat(limit) }));
    await expect(readBoundedAriaJson(requestWithBytes(bytes, {
      'content-length': '1',
    }))).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE', status: 413 });
  });

  it('fails closed when cancellation of an oversized stream fails', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(limit + 1)); },
      cancel() { throw new Error('private transport failure'); },
    });
    const request = new Request('http://localhost/api/aria/test', {
      method: 'POST', body: stream, duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    await expect(readBoundedAriaJson(request)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'ARIA_BODY_CANCEL_FAILED' },
    });
  });

  it('maps an unreadable request stream without exposing its failure', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() { throw new Error('private stream failure'); },
    });
    const request = new Request('http://localhost/api/aria/test', {
      method: 'POST', body: stream, duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    await expect(readBoundedAriaJson(request)).rejects.toMatchObject({
      code: 'BAD_REQUEST', internalDetails: { reasonCode: 'BODY_READ_FAILED' },
    });
  });

  it.each([
    ['invalid Content-Length', requestWithBytes(new TextEncoder().encode('{}'), {
      'content-length': 'not-a-number',
    })],
    ['unsafe Content-Length', requestWithBytes(new TextEncoder().encode('{}'), {
      'content-length': '9007199254740992',
    })],
    ['malformed UTF-8', requestWithBytes(Uint8Array.from([0xc3, 0x28]))],
    ['malformed JSON', requestWithBytes(new TextEncoder().encode('{"value":'))],
    ['empty body', new Request('http://localhost/api/aria/test', { method: 'POST' })],
  ])('maps %s to a stable BAD_REQUEST', async (_label, request) => {
    await expect(readBoundedAriaJson(request)).rejects.toMatchObject({
      code: 'BAD_REQUEST', status: 400,
    });
  });
});
