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
import type { Prisma } from '@prisma/client';
import { PUBLISHED_INVOICE_WHERE } from './publication';

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
  _email: string | null | undefined
): Prisma.InvoiceWhereInput | null {
  if (role === 'ADMIN' || role === 'ASSISTANTE') {
    return { id };
  }
  // Email-only callers cannot establish financial authority.
  return null;
}

type InvoiceAccessUser = {
  id: string;
  role?: string | null;
  email?: string | null;
};

/**
 * Build a Prisma WHERE clause scoped to the authenticated user.
 *
 * Parent financial access requires an explicit payer or active invoice delegation.
 * Legacy invoices remain private until their payer is independently established.
 */
export async function buildInvoiceAccessWhere(
  id: string,
  user: InvoiceAccessUser
): Promise<Prisma.InvoiceWhereInput | null> {
  const scope = await buildInvoiceListAccessWhere(user);
  return scope ? { id, ...scope } : null;
}

/** Same ownership policy for listings and individual PDF/receipt access. */
export async function buildInvoiceListAccessWhere(
  user: InvoiceAccessUser
): Promise<Prisma.InvoiceWhereInput | null> {
  if (user.role === 'ADMIN' || user.role === 'ASSISTANTE') {
    return {};
  }

  if (user.role !== 'PARENT' || !user.id) {
    return null;
  }

  const now = new Date();
  return {
    AND: [PUBLISHED_INVOICE_WHERE],
    OR: [
      { payerUserId: user.id },
      { financialDelegations: { some: {
        delegateUserId: user.id,
        revokedAt: null,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      } } },
    ],
  };
}
