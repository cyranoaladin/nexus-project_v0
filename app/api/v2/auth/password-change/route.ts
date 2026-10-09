export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { checkCsrf } from '@/lib/csrf';
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getAuthRolloutMode } from '@/lib/core-v2/auth/authority';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { resolveActor } from '@/lib/core-v2/http/actor';
import { correlationIdFrom } from '@/lib/core-v2/http/staff-route';
import { CORRELATION_HEADER, fail, failFromError, ok } from '@/lib/core-v2/http/respond';
import { changePassword, createServiceContext } from '@/lib/core-v2/services';

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
}).strict();
const BODY_MAX_BYTES = 4096;

function privateResponse(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.delete('etag');
  return response;
}

/** The target account comes exclusively from the validated session. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = correlationIdFrom(request);
  try {
    if (checkCsrf(request)) return privateResponse(fail(correlationId, 403, 'CSRF_REJECTED', 'Cross-origin request refused.'));
    const session = await auth();
    if (!session?.user?.id) return privateResponse(fail(correlationId, 401, 'UNAUTHENTICATED', 'Please sign in again.'));
    if (session.user.authority !== 'CORE_V2' || getAuthRolloutMode() === 'V1_ONLY') {
      return privateResponse(fail(correlationId, 403, 'WRONG_AUTHORITY', 'This session is not owned by Core v2.'));
    }
    const blocked = await guardSensitiveRateLimit(request, {
      scope: 'core-v2-password-change', identity: session.user.id,
    });
    if (blocked) {
      blocked.headers.set(CORRELATION_HEADER, correlationId);
      return privateResponse(blocked);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await readBoundedRequestBody(request, BODY_MAX_BYTES));
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return privateResponse(fail(correlationId, 413, 'PAYLOAD_TOO_LARGE', 'Request body too large.'));
      }
      return privateResponse(fail(correlationId, 400, 'VALIDATION', 'Invalid request body.'));
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return privateResponse(fail(correlationId, 400, 'VALIDATION', 'Invalid input.'));
    const client = await requireCoreV2Client();
    const actor = await resolveActor(client, session.user.id);
    const ctx = createServiceContext(actor, { correlationId });
    await changePassword(client, ctx, parsed.data);
    return privateResponse(ok({ sessionsRevoked: true }, correlationId));
  } catch (error) {
    return privateResponse(failFromError(error, correlationId));
  }
}
