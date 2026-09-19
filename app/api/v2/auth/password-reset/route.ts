export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requestPasswordResetByAuthority } from '@/lib/auth/password-reset-authority';
import { CORRELATION_HEADER, fail, failFromError, ok } from '@/lib/core-v2/http/respond';
import { correlationIdFrom } from '@/lib/core-v2/http/staff-route';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';

const bodySchema = z.object({ email: z.string().trim().min(3).max(320) });

/**
 * Public request for a Core v2 password-reset link (§AL/§AT). Same-origin,
 * rate-limited per IP and per e-mail, and the answer is always `accepted`
 * whether or not the e-mail names an eligible account — the only observable
 * difference is the e-mail itself. Never logs the token.
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  try {
    const tooLarge = checkBodySize(request);
    if (tooLarge) return fail(correlationId, 413, 'PAYLOAD_TOO_LARGE', 'Request body too large.');
    const csrf = checkCsrf(request);
    if (csrf) return fail(correlationId, 403, 'CSRF_REJECTED', 'Cross-origin request refused.');

    const ipBlocked = await guardSensitiveRateLimit(request, { scope: 'core-v2-password-reset-request', dimensions: ['ip'] });
    if (ipBlocked) {
      ipBlocked.headers.set(CORRELATION_HEADER, correlationId);
      return ipBlocked;
    }
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail(correlationId, 400, 'VALIDATION', 'Request body is not valid JSON.');
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return fail(correlationId, 400, 'VALIDATION', 'Invalid input.');
    const email = normalizeUserEmail(parsed.data.email);

    const identityBlocked = await guardSensitiveRateLimit(request, { scope: 'core-v2-password-reset-request', identity: email, dimensions: ['identity'] });
    if (identityBlocked) {
      identityBlocked.headers.set(CORRELATION_HEADER, correlationId);
      return identityBlocked;
    }

    await requestPasswordResetByAuthority(email, { correlationId });
    const response = ok({ accepted: true }, correlationId, 202);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  } catch (error) {
    return failFromError(error, correlationId);
  }
}
