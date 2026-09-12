export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { CORRELATION_HEADER, fail, failFromError, ok, publicUser } from '@/lib/core-v2/http/respond';
import { correlationIdFrom } from '@/lib/core-v2/http/staff-route';
import { activateAccount } from '@/lib/core-v2/services';
import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';

const bodySchema = z.object({ token: z.string().min(16).max(128), password: z.string().min(1).max(200) });

/**
 * Public, token-authenticated activation (§W). Rate-limited per IP and per
 * token, same-origin only, and every refusal is the same 404/409 pair so the
 * response never reveals whether a token ever existed. The raw token is
 * never logged: the correlation id is the only thing that reaches logs.
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  try {
    const tooLarge = checkBodySize(request);
    if (tooLarge) return fail(correlationId, 413, 'PAYLOAD_TOO_LARGE', 'Request body too large.');
    const csrf = checkCsrf(request);
    if (csrf) return fail(correlationId, 403, 'CSRF_REJECTED', 'Cross-origin request refused.');

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail(correlationId, 400, 'VALIDATION', 'Request body is not valid JSON.');
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return fail(correlationId, 400, 'VALIDATION', 'Invalid input.');

    const blocked = await guardSensitiveRateLimit(request, { scope: 'core-v2-activation', identity: parsed.data.token });
    if (blocked) {
      blocked.headers.set(CORRELATION_HEADER, correlationId);
      return blocked;
    }

    const client = await requireCoreV2Client();
    const user = await activateAccount(client, { rawToken: parsed.data.token, password: parsed.data.password }, { correlationId });
    const response = ok({ user: publicUser(user) }, correlationId);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  } catch (error) {
    return failFromError(error, correlationId);
  }
}
