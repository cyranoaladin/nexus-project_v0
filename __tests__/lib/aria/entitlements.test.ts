import {
  buildCanonicalAriaEntitlementContext,
  resolveAriaCapabilities,
  type AriaTier,
} from '@/lib/aria/kernel/entitlements';

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
  it('U006 unions valid generic grants and explicit course scopes deterministically', () => {
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

  it('resolves tier null when there is no active grant', () => {
    const context = buildCanonicalAriaEntitlementContext([], now);
    expect(context.tier).toBeNull();
  });

  it('defaults a grant with no ariaTier to ARIA_AUTONOMIE (backward compatibility)', () => {
    const context = buildCanonicalAriaEntitlementContext([grant()], now);
    expect(context.tier).toBe('ARIA_AUTONOMIE');
  });

  it('resolves tier to the highest-ranked among several active grants', () => {
    const context = buildCanonicalAriaEntitlementContext([
      grant({ id: 'g1', ariaTier: 'ARIA_AUTONOMIE' }),
      grant({ id: 'g2', ariaTier: 'ARIA_ACCOMPAGNEE' }),
      grant({ id: 'g3', ariaTier: 'ARIA_SUIVI' }),
    ], now);
    expect(context.tier).toBe('ARIA_ACCOMPAGNEE');
  });
});

describe('resolveAriaCapabilities', () => {
  it('fails closed on a tier value impossible per types but reachable at runtime (e.g. a corrupted read)', () => {
    expect(resolveAriaCapabilities('NOT_A_REAL_TIER' as unknown as Parameters<typeof resolveAriaCapabilities>[0])).toEqual({
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
  });

  it('grants nothing when tier is null (no active grant)', () => {
    expect(resolveAriaCapabilities(null)).toEqual({
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
  });

  it('ARIA_AUTONOMIE grants chat/resources/practice/practiceCorrection only', () => {
    expect(resolveAriaCapabilities('ARIA_AUTONOMIE')).toEqual({
      chat: true,
      resources: true,
      practice: true,
      practiceCorrection: true,
      parentReporting: false,
      collectiveWorkshop: false,
      liveSupport: false,
      coachInteraction: false,
      personalizedCorrection: false,
    });
  });

  it('ARIA_SUIVI adds parentReporting/collectiveWorkshop on top of ARIA_AUTONOMIE', () => {
    expect(resolveAriaCapabilities('ARIA_SUIVI')).toEqual({
      chat: true,
      resources: true,
      practice: true,
      practiceCorrection: true,
      parentReporting: true,
      collectiveWorkshop: true,
      liveSupport: false,
      coachInteraction: false,
      personalizedCorrection: false,
    });
  });

  it('ARIA_ACCOMPAGNEE adds liveSupport/coachInteraction/personalizedCorrection on top of ARIA_SUIVI', () => {
    expect(resolveAriaCapabilities('ARIA_ACCOMPAGNEE')).toEqual({
      chat: true,
      resources: true,
      practice: true,
      practiceCorrection: true,
      parentReporting: true,
      collectiveWorkshop: true,
      liveSupport: true,
      coachInteraction: true,
      personalizedCorrection: true,
    });
  });

  it('is hierarchical: every capability true at a lower tier stays true at every higher tier', () => {
    const order: readonly AriaTier[] = ['ARIA_AUTONOMIE', 'ARIA_SUIVI', 'ARIA_ACCOMPAGNEE'];
    for (let i = 0; i < order.length - 1; i += 1) {
      const lower = resolveAriaCapabilities(order[i]);
      const higher = resolveAriaCapabilities(order[i + 1]);
      for (const key of Object.keys(lower) as (keyof typeof lower)[]) {
        if (lower[key]) expect(higher[key]).toBe(true);
      }
    }
  });
});
