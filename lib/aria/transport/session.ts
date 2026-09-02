import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export function unauthorizedAriaResponse(logger?: { getRequestId?: () => string }): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'UNAUTHORIZED',
        requestId: logger?.getRequestId?.() ?? `req_${randomUUID()}`,
        retryable: false,
      },
    },
    { status: 401 },
  );
}
