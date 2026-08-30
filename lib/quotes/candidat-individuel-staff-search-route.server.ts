import 'server-only';

import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateRequestId } from '@/lib/api/helpers';
import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { isActiveForInternalStaff } from '@/lib/quotes/pipeline-flag';
import { guardSensitiveRateLimit, type SensitiveRateLimitScope } from '@/lib/rate-limit/sensitive';

type SearchErrorCode = 'INVALID_REQUEST' | 'PIPELINE_INACTIVE' | 'RATE_LIMIT_EXCEEDED' | 'SEARCH_UNAVAILABLE';

type StaffSearchHandlerOptions<TRequest, TResponse> = {
  request: NextRequest;
  requestSchema: z.ZodType<TRequest>;
  scope: SensitiveRateLimitScope;
  search: (input: TRequest) => Promise<TResponse>;
};

function sealResponse(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Request-Id', requestId);
  return response;
}

function errorResponse(code: SearchErrorCode, status: number, requestId: string): NextResponse {
  return sealResponse(NextResponse.json({ success: false, error: { code } }, { status }), requestId);
}

function logUnavailable(requestId: string): void {
  console.error({ code: 'SEARCH_UNAVAILABLE', requestId });
}

export async function handleCandidatIndividuelStaffSearch<TRequest, TResponse>(
  options: StaffSearchHandlerOptions<TRequest, TResponse>
): Promise<NextResponse> {
  const requestId = generateRequestId();

  try {
    const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
    if (isErrorResponse(session)) return sealResponse(session, requestId);

    const rateLimitResponse = await guardSensitiveRateLimit(options.request, {
      scope: options.scope,
      identity: session.user.id,
      dimensions: ['ip', 'identity'],
    });
    if (rateLimitResponse) {
      if (rateLimitResponse.status === 429) {
        const response = errorResponse('RATE_LIMIT_EXCEEDED', 429, requestId);
        const retryAfter = rateLimitResponse.headers.get('Retry-After');
        if (retryAfter) response.headers.set('Retry-After', retryAfter);
        return response;
      }
      logUnavailable(requestId);
      return errorResponse('SEARCH_UNAVAILABLE', 500, requestId);
    }

    if (!(await isActiveForInternalStaff())) return errorResponse('PIPELINE_INACTIVE', 409, requestId);

    if (!options.request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return errorResponse('INVALID_REQUEST', 400, requestId);
    }

    let body: unknown;
    try {
      body = await options.request.json();
    } catch {
      return errorResponse('INVALID_REQUEST', 400, requestId);
    }

    const parsed = options.requestSchema.safeParse(body);
    if (!parsed.success) return errorResponse('INVALID_REQUEST', 400, requestId);

    return sealResponse(NextResponse.json(await options.search(parsed.data)), requestId);
  } catch {
    logUnavailable(requestId);
    return errorResponse('SEARCH_UNAVAILABLE', 500, requestId);
  }
}
