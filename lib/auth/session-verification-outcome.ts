import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextRequest } from 'next/server';

const outcome = new AsyncLocalStorage<{ unavailable: boolean }>();

/** Technical failure is not evidence that an identity was revoked. No identity/PII is retained. */
export function recordSessionVerificationUnavailable() {
  const current = outcome.getStore();
  if (current) current.unavailable = true;
}

/** Server layouts/API guards must fail closed without turning uncertainty into a login redirect. */
export function verifyServerSession<T>(read: () => Promise<T>): Promise<T> {
  return outcome.run({ unavailable: false }, async () => {
    const result = await read();
    if (outcome.getStore()?.unavailable) throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
    return result;
  });
}

/**
 * Auth.js intentionally turns callback null/errors into 200/null and cookie deletion.
 * Preserve its canonical validation, but do not forward that response on DB outage.
 * Request-local state prevents an unavailable request contaminating another user.
 */
export function withSessionVerificationOutcome(handler: (request: NextRequest) => Promise<Response>) {
  return (request: NextRequest): Promise<Response> => outcome.run({ unavailable: false }, async () => {
    const response = await handler(request);
    if (!outcome.getStore()?.unavailable) return response;
    return Response.json({ error: 'SESSION_VERIFICATION_UNAVAILABLE' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' },
    });
  });
}
