/**
 * Normalizes the two response envelopes ARIA's client code may receive,
 * depending on which surface answered (legacy `/api/aria/**`: the payload
 * directly, error as `{ error: string }`; Core v2 `/api/v2/aria/**`, via
 * `defineStaffRoute`: `{ ok: true, data }` / `{ ok: false, error: { message } }`)
 * — so the rest of the component never has to know which surface it's
 * talking to (§C of the go-live architecture decision: same UI, only the
 * server differs).
 */

interface CoreV2Envelope<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: { readonly message?: string; readonly code?: string };
}

function isCoreV2Envelope(body: unknown): body is CoreV2Envelope<unknown> {
  return typeof body === 'object' && body !== null && 'ok' in body;
}

/** Unwraps a successful response body to the actual payload, regardless of which surface produced it. */
export function unwrapAriaResponseData<T>(body: unknown): T {
  if (isCoreV2Envelope(body) && body.data !== undefined) return body.data as T;
  return body as T;
}

/** Extracts a display-safe error message, regardless of which surface produced it. */
export function extractAriaErrorMessage(body: unknown, fallback: string): string {
  if (isCoreV2Envelope(body) && body.error?.message) return body.error.message;
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const value = (body as { error?: unknown }).error;
    if (typeof value === 'string') return value;
  }
  return fallback;
}
