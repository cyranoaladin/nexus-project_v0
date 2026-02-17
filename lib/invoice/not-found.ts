/**
 * Canonical NOT_FOUND response for all invoice public endpoints.
 *
 * No-leak design: every deny case (absent, out-of-scope, token invalid/expired/revoked,
 * forbidden role) returns the EXACT SAME payload + status + headers.
 *
 * Usage:
 *   return notFoundResponse();
 */

import { NextResponse } from 'next/server';

/** Canonical 404 JSON body — frozen, never varies. */
const NOT_FOUND_BODY = { error: 'NOT_FOUND' } as const;

/** Standard no-leak headers for 404 responses. */
const NOT_FOUND_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
} as const;

/**
 * Create a canonical 404 response.
 * Must be called each time (Response objects are single-use streams).
 */
export function notFoundResponse(): NextResponse {
  return NextResponse.json(NOT_FOUND_BODY, {
    status: 404,
    headers: NOT_FOUND_HEADERS,
  });
}

/**
 * Build a Prisma WHERE clause scoped to the user's role.
 * Returns null if the role has no invoice access at all.
 *
 * Shared across all public invoice endpoints (PDF, receipt).
 */
export function buildInvoiceScopeWhere(
  id: string,
  role: string | undefined,
  email: string | null | undefined
): Record<string, unknown> | null {
  if (role === 'ADMIN' || role === 'ASSISTANTE') {
    return { id };
  }
  if (role === 'PARENT' && email) {
    return { id, customerEmail: email };
  }
  return null;
}
