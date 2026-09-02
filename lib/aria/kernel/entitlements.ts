export interface AriaEntitlementScopeRecord {
  readonly kind: 'GLOBAL' | 'COURSE';
  readonly courseKey: string | null;
}

export interface AriaEntitlementRecord {
  readonly id: string;
  readonly productCode: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly ariaScopes: readonly AriaEntitlementScopeRecord[];
}

export interface CanonicalAriaEntitlementContext {
  readonly hasGenericAccess: boolean;
  readonly hasGlobalAccess: boolean;
  readonly courseKeys: readonly string[];
  readonly grantIds: readonly string[];
  readonly evaluatedAt: Date;
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
  });
}
