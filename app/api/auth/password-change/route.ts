export const dynamic = 'force-dynamic';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readPrivateSessionSnapshot } from '@/lib/auth/session-revocation';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { checkCsrf } from '@/lib/csrf';
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { getTrustedApplicationOrigin } from '@/lib/auth/parent-activation';
import { changeV1Password, type V1PasswordActor } from '@/lib/auth/change-v1-password';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { logger } from '@/lib/logger';

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
}).strict();

function privateResponse(response: NextResponse, correlationId: string): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Correlation-ID', correlationId);
  response.headers.delete('etag');
  return response;
}

function refusal(status: number, code: string, correlationId: string): NextResponse {
  return privateResponse(NextResponse.json({ ok: false, error: { code } }, { status }), correlationId);
}

/** Native V1 mutation; never forwards the request to the application itself. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = randomUUID();
  try {
    if (checkCsrf(request)) return refusal(403, 'CSRF_REJECTED', correlationId);
    const session = await auth();
    if (!session?.user?.id) return refusal(401, 'UNAUTHENTICATED', correlationId);
    if (session.user.authority === 'CORE_V2') return refusal(403, 'WRONG_AUTHORITY', correlationId);
    const blocked = await guardSensitiveRateLimit(request, {
      scope: 'v1-password-change', identity: session.user.id,
    });
    if (blocked) return privateResponse(blocked, correlationId);

    // Keep the version in the private encrypted JWT, never in the public session.
    const origin = getTrustedApplicationOrigin();
    if (process.env.AUTH_URL && new URL(process.env.AUTH_URL).origin !== origin.origin) {
      throw ApiError.serviceUnavailable();
    }
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret || secret.length < 32) throw ApiError.serviceUnavailable();
    // Bind this snapshot to the same session cookie auth() validated, not Bearer.
    const token = await readPrivateSessionSnapshot(request, { secret, secureCookie: origin.protocol === 'https:' });
    if (!token || token.id !== session.user.id || token.role !== session.user.role
      || (token.authority !== undefined && token.authority !== 'V1')
      || typeof token.sessionVersion !== 'number' || !Number.isSafeInteger(token.sessionVersion)
      || token.sessionVersion < 0) return refusal(401, 'UNAUTHENTICATED', correlationId);

    let body: unknown;
    try { body = JSON.parse(await readBoundedRequestBody(request, 4096)); }
    catch (error) {
      return refusal(error instanceof RequestBodyTooLargeError ? 413 : 400,
        error instanceof RequestBodyTooLargeError ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR', correlationId);
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return refusal(400, 'VALIDATION_ERROR', correlationId);
    const actor: V1PasswordActor = {
      userId: session.user.id, role: session.user.role,
      authority: 'V1', sessionVersion: token.sessionVersion,
    };
    await changeV1Password(prisma, actor, parsed.data, correlationId);
    return privateResponse(NextResponse.json({ ok: true, data: { sessionsRevoked: true } }), correlationId);
  } catch (error) {
    if (error instanceof ApiError) return refusal(error.statusCode, error.code, correlationId);
    logger.error({ event: 'account.password_change_failed', correlationId }, 'Password change failed');
    return refusal(503, 'SERVICE_UNAVAILABLE', correlationId);
  }
}
