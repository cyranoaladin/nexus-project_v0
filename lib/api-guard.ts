/**
 * Canonical API Guard
 *
 * Single entry-point for API route protection.
 * Combines: auth, role check, ownership, and rate limiting.
 *
 * Usage:
 *   const result = await apiGuard({
 *     policy: 'parent.children',
 *     resourceId: childId,
 *     rateLimit: { key: 'parent-children', max: 30, window: 60 },
 *   });
 *   if (isErrorResponse(result)) return result;
 *   const session = result;
 */

import { NextResponse } from 'next/server';
import { enforcePolicyWithOwnership } from '@/lib/rbac';
import { isErrorResponse } from '@/lib/guards';
import type { AuthSession } from '@/lib/guards';

export interface ApiGuardOptions {
  /** RBAC policy key */
  policy: string;
  /** Resource ID for ownership check (e.g. studentId, invoiceId) */
  resourceId?: string;
}

/**
 * Canonical API Guard
 *
 * Single entry-point for API route protection.
 * Combines auth, role check, and ownership in one call.
 *
 * Usage:
 *   const result = await apiGuard({
 *     policy: 'parent.children',
 *     resourceId: childId,
 *   });
 *   if (isErrorResponse(result)) return result;
 *   const session = result;
 */
export async function apiGuard(
  options: ApiGuardOptions
): Promise<AuthSession | NextResponse> {
  const sessionOrResponse = await enforcePolicyWithOwnership(
    options.policy,
    options.resourceId
  );
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  return sessionOrResponse;
}
