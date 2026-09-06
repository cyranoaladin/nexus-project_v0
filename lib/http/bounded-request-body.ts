/** Bound memory consumption even for requests without a Content-Length header. */
export class RequestBodyTooLargeError extends Error {
  constructor() { super('REQUEST_BODY_TOO_LARGE'); this.name = 'RequestBodyTooLargeError'; }
}

export async function readBoundedRequestBody(request: Request, maxBytes = 1024 * 1024): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('INVALID_BODY_LIMIT');
  if (Number(request.headers.get('content-length') ?? '0') > maxBytes) throw new RequestBodyTooLargeError();
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
