/**
 * Access Rules — Pure function resolver for feature gating.
 *
 * Combines RBAC (role) + Entitlements (paid features) into a single
 * access decision. No Next.js dependencies — fully testable.
 *
 * Decision flow:
 * 1. No userId → denied (auth required)
 * 2. Role in rolesExempt → allowed (ADMIN, ASSISTANTE bypass)
 * 3. No requires → allowed (feature has no entitlement requirement)
 * 4. Check entitlement features → allowed if all present, denied with missing[]
 */

import { getFeatureDefinition } from './features';
import type { FeatureKey, FallbackMode } from './features';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AccessRequest {
  /** User role (ADMIN, ASSISTANTE, COACH, PARENT, ELEVE) */
  role: string | null | undefined;
  /** User ID (null = not authenticated) */
  userId: string | null | undefined;
  /** Feature to check access for */
  featureKey: FeatureKey;
  /** Active entitlement features for this user (pre-resolved) */
  activeFeatures: string[];
}

export interface AccessResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason for denial (null if allowed) */
  reason: string | null;
  /** Fallback mode from feature definition */
  mode: FallbackMode;
  /** Missing entitlement features (empty if allowed) */
  missing: string[];
}

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Resolve access for a feature request.
 *
 * Pure function — no DB calls, no side effects.
 * Caller must pre-resolve activeFeatures via getUserEntitlements/hasFeature.
 */
export function resolveAccess(request: AccessRequest): AccessResult {
  const feature = getFeatureDefinition(request.featureKey);

  // Unknown feature → denied
  if (!feature) {
    return {
      allowed: false,
      reason: 'unknown_feature',
      mode: 'REDIRECT',
      missing: [request.featureKey],
    };
  }

  // No userId → auth required
  if (!request.userId) {
    return {
      allowed: false,
      reason: 'auth_required',
      mode: 'REDIRECT',
      missing: [],
    };
  }

  // No role → denied
  if (!request.role) {
    return {
      allowed: false,
      reason: 'no_role',
      mode: 'REDIRECT',
      missing: [],
    };
  }

  // Role exempt → allowed (ADMIN, ASSISTANTE, etc.)
  if (feature.rolesExempt.includes(request.role)) {
    return {
      allowed: true,
      reason: null,
      mode: feature.fallback,
      missing: [],
    };
  }

  // No entitlement requirements → allowed
  if (feature.requires.length === 0) {
    return {
      allowed: true,
      reason: null,
      mode: feature.fallback,
      missing: [],
    };
  }

  // Check entitlement features
  const missing = feature.requires.filter(
    (req) => !request.activeFeatures.includes(req)
  );

  if (missing.length > 0) {
    return {
      allowed: false,
      reason: 'missing_entitlement',
      mode: feature.fallback,
      missing,
    };
  }

  // All checks passed
  return {
    allowed: true,
    reason: null,
    mode: feature.fallback,
    missing: [],
  };
}
