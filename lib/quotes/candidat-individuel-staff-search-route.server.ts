import 'server-only';

import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateRequestId } from '@/lib/api/helpers';
import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { isActiveForInternalStaff } from '@/lib/quotes/pipeline-flag';
import { guardSensitiveRateLimit, type SensitiveRateLimitScope } from '@/lib/rate-limit/sensitive';
import {
  CANDIDAT_INDIVIDUEL_SEARCH_ERROR_STATUS,
  candidatIndividuelSearchErrorSchema,
  type CandidatIndividuelSearchErrorCode,
} from '@/lib/quotes/candidat-individuel-search-contracts';

type StaffSearchOperation =
  | 'candidate-student-search'
  | 'candidate-lead-search'
  | 'quote-lead-search'
  | 'planning-student-search';

type StaffSearchHandlerOptions<TRequest, TResponse> = {
  request: NextRequest;
  requestSchema: z.ZodType<TRequest>;
  responseSchema: z.ZodType<TResponse>;
  scope: SensitiveRateLimitScope;
  operation: StaffSearchOperation;
  requireInternalPipeline?: boolean;
  search: (input: TRequest) => Promise<TResponse>;
};

function sealResponse(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Request-Id', requestId);
  return response;
}

function errorResponse(code: CandidatIndividuelSearchErrorCode, requestId: string): NextResponse {
  const body = candidatIndividuelSearchErrorSchema.parse({ success: false, error: { code } });
  return sealResponse(NextResponse.json(body, { status: CANDIDAT_INDIVIDUEL_SEARCH_ERROR_STATUS[code] }), requestId);
}

function logUnavailable(operation: StaffSearchOperation, requestId: string): void {
  console.error({ operation, code: 'SEARCH_UNAVAILABLE', status: CANDIDAT_INDIVIDUEL_SEARCH_ERROR_STATUS.SEARCH_UNAVAILABLE, requestId });
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
        const response = errorResponse('RATE_LIMIT_EXCEEDED', requestId);
        const retryAfter = rateLimitResponse.headers.get('Retry-After');
        if (retryAfter) response.headers.set('Retry-After', retryAfter);
        return response;
      }
      logUnavailable(options.operation, requestId);
      return errorResponse('SEARCH_UNAVAILABLE', requestId);
    }

    if (options.requireInternalPipeline !== false && !(await isActiveForInternalStaff())) {
      return errorResponse('PIPELINE_INACTIVE', requestId);
    }

    const contentTypeEssence = options.request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentTypeEssence !== 'application/json') {
      return errorResponse('INVALID_REQUEST', requestId);
    }

    let body: unknown;
    try {
      body = await options.request.json();
    } catch {
      return errorResponse('INVALID_REQUEST', requestId);
    }

    const parsed = options.requestSchema.safeParse(body);
    if (!parsed.success) return errorResponse('INVALID_REQUEST', requestId);

    const result = options.responseSchema.parse(await options.search(parsed.data));
    return sealResponse(NextResponse.json(result), requestId);
  } catch {
    logUnavailable(options.operation, requestId);
    return errorResponse('SEARCH_UNAVAILABLE', requestId);
  }
}
