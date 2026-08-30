import { buildCanonicalAriaEntitlementContext } from '@/lib/aria/kernel/entitlements';

const now = new Date('2026-08-30T12:00:00.000Z');

function grant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grant-active',
    productCode: 'ARIA_ACCESS',
    status: 'ACTIVE' as const,
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2026-09-30T00:00:00.000Z'),
    ariaScopes: [{ kind: 'COURSE' as const, courseKey: 'eds-maths-premiere' }],
    ...overrides,
  };
}

describe('canonical ARIA entitlement context', () => {
  it('U006 ARIA-B-R026 unions valid generic grants and explicit course scopes deterministically', () => {
    const context = buildCanonicalAriaEntitlementContext([
      grant({ id: 'grant-b', ariaScopes: [
        { kind: 'COURSE', courseKey: 'eds-nsi-premiere' },
        { kind: 'COURSE', courseKey: 'eds-maths-premiere' },
      ] }),
      grant({ id: 'grant-a', ariaScopes: [
        { kind: 'COURSE', courseKey: 'eds-maths-premiere' },
      ] }),
    ], now);

    expect(context).toMatchObject({
      hasGenericAccess: true,
      hasGlobalAccess: false,
      courseKeys: ['eds-maths-premiere', 'eds-nsi-premiere'],
      grantIds: ['grant-a', 'grant-b'],
    });
    expect(Object.isFrozen(context.courseKeys)).toBe(true);
  });

  it('ignores non-ARIA, inactive, revoked, expired and not-yet-active grants', () => {
    const context = buildCanonicalAriaEntitlementContext([
      grant({ id: 'other-product', productCode: 'MASTERIUM' }),
      grant({ id: 'suspended', status: 'SUSPENDED' }),
      grant({ id: 'revoked', status: 'REVOKED' }),
      grant({ id: 'expired-status', status: 'EXPIRED' }),
      grant({ id: 'ended-now', endsAt: now }),
      grant({ id: 'future', startsAt: new Date('2026-08-31T00:00:00.000Z') }),
    ] as never, now);

    expect(context).toMatchObject({
      hasGenericAccess: false,
      hasGlobalAccess: false,
      courseKeys: [],
      grantIds: [],
    });
  });

  it('U009 accepts only the explicit GLOBAL null-scope shape', () => {
    const context = buildCanonicalAriaEntitlementContext([
      grant({ ariaScopes: [
        { kind: 'GLOBAL', courseKey: 'eds-maths-premiere' },
        { kind: 'GLOBAL', courseKey: null },
        { kind: 'COURSE', courseKey: null },
      ] }),
    ] as never, now);

    expect(context.hasGlobalAccess).toBe(true);
    expect(context.courseKeys).toEqual([]);
  });

  it('keeps an active generic grant without scope fail-closed for every course', () => {
    const context = buildCanonicalAriaEntitlementContext([
      grant({ ariaScopes: [] }),
    ], now);

    expect(context.hasGenericAccess).toBe(true);
    expect(context.hasGlobalAccess).toBe(false);
    expect(context.courseKeys).toEqual([]);
  });
});
