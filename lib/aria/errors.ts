import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  serializeAriaPublicError,
  type AriaPublicErrorLogger,
} from './application/public-error';

export { AriaError, type AriaErrorCode } from './kernel/errors';

type RequestLogger = AriaPublicErrorLogger & { getRequestId?: () => string };

export function toAriaErrorResponse(error: unknown, logger?: RequestLogger): NextResponse {
  const serialized = serializeAriaPublicError(error, {
    requestId: logger?.getRequestId?.() ?? `req_${randomUUID()}`,
    phase: 'PRE_STREAM',
    logger,
  });
  return NextResponse.json(serialized.body, { status: serialized.status });
}
