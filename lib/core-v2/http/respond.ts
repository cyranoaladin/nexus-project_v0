/**
 * HTTP envelope for the Core v2 API surface (app/api/v2/**). One shape for
 * every success and every failure, the correlation id on both, and the
 * domain error taxonomy mapped to a fixed status table — routes never
 * hand-roll a status code.
 */
import { NextResponse } from 'next/server';
import type { User } from '@/core-v2/generated/client';
import { CoreV2DatabaseIdentityError, CoreV2DatabaseUrlError } from '../client';
import { CoreV2ConfigError } from '../config';
import { CoreV2DomainError, type CoreV2ErrorCode } from '../errors';

export const CORRELATION_HEADER = 'x-correlation-id';

const STATUS_BY_CODE: Readonly<Record<CoreV2ErrorCode, number>> = {
  VALIDATION: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
};

export interface ApiErrorBody {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string; readonly details?: Record<string, unknown> };
  readonly correlationId: string;
}

export function ok<T>(data: T, correlationId: string, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status, headers: { [CORRELATION_HEADER]: correlationId } });
}

export function fail(
  correlationId: string,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): NextResponse {
  const body: ApiErrorBody = { ok: false, error: { code, message, ...(details ? { details } : {}) }, correlationId };
  return NextResponse.json(body, { status, headers: { [CORRELATION_HEADER]: correlationId } });
}

/** Maps any thrown value to a response. Unknown errors are 500 with the correlation id and NO internal detail. */
export function failFromError(error: unknown, correlationId: string): NextResponse {
  if (error instanceof CoreV2DomainError) {
    return fail(correlationId, STATUS_BY_CODE[error.code], error.code, error.message, error.details);
  }
  if (error instanceof CoreV2DatabaseUrlError || error instanceof CoreV2DatabaseIdentityError) {
    return fail(correlationId, 503, 'CORE_V2_UNAVAILABLE', 'Core v2 is not configured on this deployment.');
  }
  if (error instanceof CoreV2ConfigError) {
    return fail(correlationId, 503, 'CORE_V2_MISCONFIGURED', error.message);
  }
  return fail(correlationId, 500, 'INTERNAL_ERROR', 'Unexpected error.');
}

export type PublicUser = Pick<
  User,
  'id' | 'role' | 'firstName' | 'lastName' | 'email' | 'phone' | 'accountStatus' | 'activatedAt' | 'createdAt' | 'updatedAt'
>;

/** Never let a password hash or session version cross the API boundary. */
export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    accountStatus: user.accountStatus,
    activatedAt: user.activatedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
