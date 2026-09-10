export interface AriaEntitlementScopeRecord {
  readonly kind: 'GLOBAL' | 'COURSE';
  readonly courseKey: string | null;
}

/** Formule commerciale ARIA — voir prisma/schema.prisma `AriaTier`. */
export type AriaTier = 'ARIA_AUTONOMIE' | 'ARIA_SUIVI' | 'ARIA_ACCOMPAGNEE';

const ARIA_TIER_RANK: Readonly<Record<AriaTier, number>> = Object.freeze({
  ARIA_AUTONOMIE: 0,
  ARIA_SUIVI: 1,
  ARIA_ACCOMPAGNEE: 2,
});

export interface AriaEntitlementRecord {
  readonly id: string;
  readonly productCode: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly ariaScopes: readonly AriaEntitlementScopeRecord[];
  /**
   * Optional: absent on grants recorded before this dimension existed.
   * `resolveTier` below treats a null/undefined tier on an otherwise-active
   * grant as ARIA_AUTONOMIE (the lowest tier), never as no-access.
   */
  readonly ariaTier?: AriaTier | null;
}

export interface CanonicalAriaEntitlementContext {
  readonly hasGenericAccess: boolean;
  readonly hasGlobalAccess: boolean;
  readonly courseKeys: readonly string[];
  readonly grantIds: readonly string[];
  readonly evaluatedAt: Date;
  /** Highest tier among active grants; null iff hasGenericAccess is false. */
  readonly tier: AriaTier | null;
}

/** Highest-ranked tier across active grants; null-tier grants count as AUTONOMIE. */
function resolveTier(grants: readonly AriaEntitlementRecord[]): AriaTier | null {
  let best: AriaTier | null = null;
  for (const grant of grants) {
    const candidate: AriaTier = grant.ariaTier ?? 'ARIA_AUTONOMIE';
    if (best === null || ARIA_TIER_RANK[candidate] > ARIA_TIER_RANK[best]) {
      best = candidate;
    }
  }
  return best;
}

/** One canonical commercial truth: active/date-valid Entitlement + strict scopes. */
export function buildCanonicalAriaEntitlementContext(
  records: readonly AriaEntitlementRecord[],
  now: Date,
): CanonicalAriaEntitlementContext {
  const grants = records.filter((record) =>
    record.productCode === 'ARIA_ACCESS'
    && record.status === 'ACTIVE'
    && record.startsAt <= now
    && (record.endsAt === null || record.endsAt > now),
  );
  const courseKeys = new Set<string>();
  let hasGlobalAccess = false;
  for (const grant of grants) {
    for (const scope of grant.ariaScopes) {
      if (scope.kind === 'GLOBAL' && scope.courseKey === null) {
        hasGlobalAccess = true;
      } else if (scope.kind === 'COURSE' && scope.courseKey) {
        courseKeys.add(scope.courseKey);
      }
    }
  }
  return Object.freeze({
    hasGenericAccess: grants.length > 0,
    hasGlobalAccess,
    courseKeys: Object.freeze([...courseKeys].sort()),
    grantIds: Object.freeze(grants.map(({ id }) => id).sort()),
    evaluatedAt: new Date(now),
    tier: resolveTier(grants),
  });
}

export interface AriaCapabilities {
  readonly chat: boolean;
  readonly resources: boolean;
  readonly practice: boolean;
  readonly practiceCorrection: boolean;
  readonly parentReporting: boolean;
  readonly collectiveWorkshop: boolean;
  readonly liveSupport: boolean;
  readonly coachInteraction: boolean;
  readonly personalizedCorrection: boolean;
}

const NO_CAPABILITIES: AriaCapabilities = Object.freeze({
  chat: false,
  resources: false,
  practice: false,
  practiceCorrection: false,
  parentReporting: false,
  collectiveWorkshop: false,
  liveSupport: false,
  coachInteraction: false,
  personalizedCorrection: false,
});

const AUTONOMIE_CAPABILITIES: AriaCapabilities = Object.freeze({
  ...NO_CAPABILITIES,
  chat: true,
  resources: true,
  practice: true,
  practiceCorrection: true,
});

const SUIVI_CAPABILITIES: AriaCapabilities = Object.freeze({
  ...AUTONOMIE_CAPABILITIES,
  parentReporting: true,
  collectiveWorkshop: true,
});

const ACCOMPAGNEE_CAPABILITIES: AriaCapabilities = Object.freeze({
  ...SUIVI_CAPABILITIES,
  liveSupport: true,
  coachInteraction: true,
  personalizedCorrection: true,
});

const CAPABILITIES_BY_TIER: Readonly<Record<AriaTier, AriaCapabilities>> = Object.freeze({
  ARIA_AUTONOMIE: AUTONOMIE_CAPABILITIES,
  ARIA_SUIVI: SUIVI_CAPABILITIES,
  ARIA_ACCOMPAGNEE: ACCOMPAGNEE_CAPABILITIES,
});

/**
 * Fail-closed capability matrix for a resolved tier, on top of the existing
 * course-scope access gate (`hasGlobalAccess || courseKeys.includes(courseKey)`
 * in `lib/aria/access.ts`, unchanged). This function answers "what can this
 * tier do", not "is ARIA reachable for this course at all" — callers must
 * still apply the existing scope check before consulting these flags.
 *
 * `tier: null` (no active grant) or an unrecognized tier value both resolve
 * to every capability false — never partial/best-effort access.
 */
export function resolveAriaCapabilities(tier: AriaTier | null): AriaCapabilities {
  if (tier === null) return NO_CAPABILITIES;
  return CAPABILITIES_BY_TIER[tier] ?? NO_CAPABILITIES;
}
