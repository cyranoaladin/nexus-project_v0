/**
 * Access Guard — Server-side feature gating for Next.js.
 *
 * Provides `requireFeature()` for use in Server Components and API routes.
 * Combines session auth + entitlement check via resolveAccess().
 *
 * - Pages: redirect to /access-required
 * - API routes: return 403 JSON response
 * - No PII in logs, no entitlement details leaked
 */

import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserEntitlements } from '@/lib/entitlement';
import { resolveAccess } from './rules';
import type { FeatureKey } from './features';
import type { AccessResult } from './rules';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuardOptions {
  /** Context: 'page' for Server Components, 'api' for API routes */
  context?: 'page' | 'api';
  /** Custom redirect URL (default: /access-required) */
  redirectUrl?: string;
  /** Pre-resolved session user (skips getServerSession call if provided) */
  session?: { id: string; role: string } | null;
}

export interface GuardResult {
  /** Access decision */
  access: AccessResult;
  /** Session user (null if not authenticated) */
  user: { id: string; role: string } | null;
}

// ─── Page Guard (Server Components) ─────────────────────────────────────────

/**
 * Guard a Server Component page by feature key.
 *
 * If denied:
 * - No session → redirect to /auth/signin
 * - Missing entitlement → redirect to /access-required?feature=...&reason=...
 *
 * If allowed: returns { access, user } for the page to use.
 *
 * @throws redirect (Next.js server redirect — never returns on denial)
 */
export async function requireFeature(
  featureKey: FeatureKey,
  options: GuardOptions = {}
): Promise<GuardResult> {
  const { context = 'page', redirectUrl = '/access-required', session: preResolved } = options;

  // Use pre-resolved session if provided, otherwise fetch from next-auth
  let userId: string | null;
  let role: string | null;
  if (preResolved !== undefined) {
    userId = preResolved?.id ?? null;
    role = preResolved?.role ?? null;
  } else {
    const sess = await auth();
    userId = sess?.user?.id ?? null;
    role = (sess?.user as { role?: string } | undefined)?.role ?? null;
  }

  // Resolve active features for this user
  let activeFeatures: string[] = [];
  if (userId) {
    try {
      const entitlements = await getUserEntitlements(userId);
      activeFeatures = entitlements.flatMap((e) => e.features);
    } catch {
      // DB error → treat as no features (safe fallback)
      activeFeatures = [];
    }
  }

  const access = resolveAccess({
    role,
    userId,
    featureKey,
    activeFeatures,
  });

  if (access.allowed) {
    return { access, user: userId && role ? { id: userId, role } : null };
  }

  // ─── Denied ────────────────────────────────────────────────────────

  if (context === 'api') {
    // API routes: caller handles the response (see requireFeatureApi)
    return { access, user: userId && role ? { id: userId, role } : null };
  }

  // Page context: redirect
  if (access.reason === 'auth_required' || access.reason === 'no_role') {
    redirect('/auth/signin');
  }

  const params = new URLSearchParams({
    feature: featureKey,
    reason: access.reason ?? 'denied',
    ...(access.missing.length > 0 ? { missing: access.missing.join(',') } : {}),
  });

  redirect(`${redirectUrl}?${params.toString()}`);
}

// ─── API Guard ───────────────────────────────────────────────────────────────

/**
 * Guard an API route by feature key.
 *
 * Returns null if allowed, or a NextResponse (403/401) if denied.
 * Caller should check: `const denied = await requireFeatureApi(...); if (denied) return denied;`
 *
 * @param session - Optional pre-resolved session (avoids double getServerSession call)
 */
export async function requireFeatureApi(
  featureKey: FeatureKey,
  session?: { id: string; role: string } | null
): Promise<NextResponse | null> {
  const { access } = await requireFeature(featureKey, { context: 'api', session });

  if (access.allowed) return null;

  if (access.reason === 'auth_required' || access.reason === 'no_role') {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { error: 'Accès requis', feature: featureKey, reason: access.reason },
    { status: 403 }
  );
}
