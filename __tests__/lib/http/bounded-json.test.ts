import {
  DEFAULT_BOUNDED_JSON_BYTES,
  readBoundedJson,
} from '@/lib/http/bounded-json';

function streamedRequest(chunks: string[], headers?: HeadersInit): Request {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers,
    body: stream,
    duplex: 'half',
  } as RequestInit);
}

describe('readBoundedJson', () => {
  it('parses a streamed JSON body using actual bytes', async () => {
    await expect(readBoundedJson(
      streamedRequest(['{"ok":', 'true}']),
      { maxBytes: 16 },
    )).resolves.toEqual({ ok: true, value: { ok: true } });
  });

  it('rejects actual bytes over the bound even with an under-declared length', async () => {
    const result = await readBoundedJson(
      streamedRequest(['{"value":"', '0123456789', '"}'], {
        'content-length': '1',
      }),
      { maxBytes: 12 },
    );
    expect(result).toEqual({ ok: false, kind: 'TOO_LARGE' });
  });

  it('counts UTF-8 bytes rather than JavaScript characters', async () => {
    const result = await readBoundedJson(
      streamedRequest(['{"v":"é"}']),
      { maxBytes: 9 },
    );
    expect(result).toEqual({ ok: false, kind: 'TOO_LARGE' });
  });

  it('classifies malformed JSON without throwing or echoing input', async () => {
    await expect(readBoundedJson(
      streamedRequest(['{"secret":"minor@example.com"']),
      { maxBytes: 100 },
    )).resolves.toEqual({ ok: false, kind: 'MALFORMED' });
  });

  it('uses a one-megabyte default bound', () => {
    expect(DEFAULT_BOUNDED_JSON_BYTES).toBe(1024 * 1024);
  });
});
