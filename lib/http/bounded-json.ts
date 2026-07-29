import 'server-only';

export const DEFAULT_BOUNDED_JSON_BYTES = 1024 * 1024;

export type BoundedJsonResult =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; kind: 'TOO_LARGE' | 'MALFORMED' }>;

export async function readBoundedJson(
  request: Request,
  options: Readonly<{ maxBytes?: number }> = {},
): Promise<BoundedJsonResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_BOUNDED_JSON_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !request.body) {
    return { ok: false, kind: 'MALFORMED' };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size classification is authoritative even if cancellation fails.
        }
        return { ok: false, kind: 'TOO_LARGE' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, kind: 'MALFORMED' };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, kind: 'MALFORMED' };
  }
}
