import { setupServiceHarness } from '../helpers/service-harness';
import {
  adaptCoreV2AriaAccessGrant,
  adaptCoreV2AriaAccessGrants,
  buildCoreV2AriaEntitlements,
  loadCoreV2AriaAccessGrants,
  resolveCoreV2AriaEntitlements,
  type CoreV2AriaAccessGrantRecord,
} from '@/lib/core-v2/aria/access-grants';

const NOW = new Date('2026-09-23T12:00:00.000Z');
const STARTED_AT = new Date('2026-09-01T00:00:00.000Z');

function grant(
  overrides: Partial<CoreV2AriaAccessGrantRecord> = {},
): CoreV2AriaAccessGrantRecord {
  return {
    id: 'grant-autonomie',
    featureKey: 'aria_maths',
    courseScopes: [],
    status: 'ACTIVE',
    startsAt: STARTED_AT,
    endsAt: null,
    ariaTier: 'ARIA_AUTONOMIE',
    ...overrides,
  };
}

describe('Core v2 AriaAccessGrant canonical adapter (pure)', () => {
  test('maps a global AUTONOMIE grant to the exact canonical record', () => {
    expect(adaptCoreV2AriaAccessGrant(grant())).toEqual({
      id: 'grant-autonomie',
      productCode: 'ARIA_ACCESS',
      status: 'ACTIVE',
      startsAt: STARTED_AT,
      endsAt: null,
      ariaTier: 'ARIA_AUTONOMIE',
      ariaScopes: [{ kind: 'GLOBAL', courseKey: null }],
    });
  });

  test('maps non-empty courseScopes to exact COURSE scopes without adding GLOBAL', () => {
    const startsAt = new Date('2026-09-02T00:00:00.000Z');
    const endsAt = new Date('2027-06-30T23:59:59.000Z');
    expect(adaptCoreV2AriaAccessGrant(grant({
      id: 'grant-accompagnee',
      courseScopes: ['maths-terminale-eds', 'nsi-terminale-eds'],
      status: 'REVOKED',
      startsAt,
      endsAt,
      ariaTier: 'ARIA_ACCOMPAGNEE',
    }))).toEqual({
      id: 'grant-accompagnee',
      productCode: 'ARIA_ACCESS',
      status: 'REVOKED',
      startsAt,
      endsAt,
      ariaTier: 'ARIA_ACCOMPAGNEE',
      ariaScopes: [
        { kind: 'COURSE', courseKey: 'maths-terminale-eds' },
        { kind: 'COURSE', courseKey: 'nsi-terminale-eds' },
      ],
    });
  });

  test('adapts every input grant without applying a second validity filter', () => {
    const rows = [
      grant(),
      grant({ id: 'expired', status: 'EXPIRED', ariaTier: 'ARIA_SUIVI' }),
      grant({ id: 'revoked', status: 'REVOKED', ariaTier: 'ARIA_ACCOMPAGNEE' }),
    ];
    expect(adaptCoreV2AriaAccessGrants(rows).map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'grant-autonomie', status: 'ACTIVE' },
      { id: 'expired', status: 'EXPIRED' },
      { id: 'revoked', status: 'REVOKED' },
    ]);
  });

  test('resolves global AUTONOMIE access and its commercial capabilities', () => {
    const result = buildCoreV2AriaEntitlements([grant()], NOW);
    expect(result.aggregate).toMatchObject({
      hasGenericAccess: true,
      hasGlobalAccess: true,
      courseKeys: [],
      grantIds: ['grant-autonomie'],
      tier: 'ARIA_AUTONOMIE',
    });
    expect(result.byFeatureKey.get('aria_maths')).toMatchObject({
      hasGenericAccess: true,
      hasGlobalAccess: true,
      tier: 'ARIA_AUTONOMIE',
    });
    expect(result.capabilities).toMatchObject({ chat: true, resources: true, practice: true, parentReporting: false });
    expect(result.features).toEqual(['aria_maths']);
  });

  test('resolves global SUIVI access from the canonical capability matrix', () => {
    const result = buildCoreV2AriaEntitlements([
      grant({ id: 'grant-suivi', featureKey: 'aria_nsi', ariaTier: 'ARIA_SUIVI' }),
    ], NOW);
    expect(result.aggregate.tier).toBe('ARIA_SUIVI');
    expect(result.byFeatureKey.get('aria_nsi')).toMatchObject({ hasGlobalAccess: true, tier: 'ARIA_SUIVI' });
    expect(result.capabilities).toMatchObject({
      chat: true,
      parentReporting: true,
      collectiveWorkshop: true,
      liveSupport: false,
    });
  });

  test('resolves scoped ACCOMPAGNEE access without widening it to global', () => {
    const result = buildCoreV2AriaEntitlements([
      grant({
        id: 'grant-accompagnee',
        courseScopes: ['maths-terminale-eds'],
        ariaTier: 'ARIA_ACCOMPAGNEE',
      }),
    ], NOW);
    expect(result.aggregate).toMatchObject({
      hasGenericAccess: true,
      hasGlobalAccess: false,
      courseKeys: ['maths-terminale-eds'],
      tier: 'ARIA_ACCOMPAGNEE',
    });
    expect(result.byFeatureKey.get('aria_maths')).toMatchObject({
      hasGlobalAccess: false,
      courseKeys: ['maths-terminale-eds'],
      tier: 'ARIA_ACCOMPAGNEE',
    });
    expect(result.capabilities).toMatchObject({ liveSupport: true, coachInteraction: true, personalizedCorrection: true });
  });

  test('selects the highest tier across multiple active grants through the canonical kernel', () => {
    const result = buildCoreV2AriaEntitlements([
      grant({ id: 'autonomie', featureKey: 'aria_maths', ariaTier: 'ARIA_AUTONOMIE' }),
      grant({ id: 'accompagnee', featureKey: 'aria_nsi', ariaTier: 'ARIA_ACCOMPAGNEE' }),
      grant({ id: 'suivi', featureKey: 'aria_maths', ariaTier: 'ARIA_SUIVI' }),
    ], NOW);
    expect(result.aggregate.tier).toBe('ARIA_ACCOMPAGNEE');
    expect(result.capabilities.personalizedCorrection).toBe(true);
    expect(result.byFeatureKey.get('aria_maths')?.tier).toBe('ARIA_SUIVI');
    expect(result.byFeatureKey.get('aria_nsi')?.tier).toBe('ARIA_ACCOMPAGNEE');
  });

  test('ignores a date-expired grant in aggregate, feature contexts and compatibility features', () => {
    const result = buildCoreV2AriaEntitlements([
      grant({ id: 'ended', endsAt: new Date('2026-09-23T11:59:59.000Z'), ariaTier: 'ARIA_ACCOMPAGNEE' }),
    ], NOW);
    expect(result.aggregate).toMatchObject({ hasGenericAccess: false, tier: null, grantIds: [] });
    expect(result.byFeatureKey.get('aria_maths')).toMatchObject({ hasGenericAccess: false, tier: null });
    expect(result.capabilities).toMatchObject({ chat: false, resources: false, personalizedCorrection: false });
    expect(result.features).toEqual([]);
  });

  test('ignores a revoked grant in aggregate, feature contexts and compatibility features', () => {
    const result = buildCoreV2AriaEntitlements([
      grant({ id: 'revoked', status: 'REVOKED', ariaTier: 'ARIA_ACCOMPAGNEE' }),
    ], NOW);
    expect(result.aggregate).toMatchObject({ hasGenericAccess: false, tier: null, grantIds: [] });
    expect(result.byFeatureKey.get('aria_maths')).toMatchObject({ hasGenericAccess: false, tier: null });
    expect(result.capabilities).toMatchObject({ chat: false, resources: false, personalizedCorrection: false });
    expect(result.features).toEqual([]);
  });

  test('no grant yields no commercial access or capability', () => {
    const result = buildCoreV2AriaEntitlements([], NOW);
    expect(result.aggregate).toMatchObject({
      hasGenericAccess: false,
      hasGlobalAccess: false,
      courseKeys: [],
      grantIds: [],
      tier: null,
    });
    expect([...result.byFeatureKey]).toEqual([]);
    expect(Object.values(result.capabilities).every((value) => value === false)).toBe(true);
    expect(result.features).toEqual([]);
  });
});

describe('Core v2 AriaAccessGrant repository', () => {
  const h = setupServiceHarness();

  async function seedStudent() {
    const user = await h.client.user.create({
      data: { role: 'ELEVE', email: 'grant-student@synthetic.test', accountStatus: 'ACTIVE' },
    });
    const household = await h.client.household.create({ data: {} });
    return h.client.student.create({ data: { userId: user.id, householdId: household.id } });
  }

  test('loads the exact authorization projection for ACTIVE, EXPIRED and REVOKED rows with only studentId in WHERE', async () => {
    const student = await seedStudent();
    const endedAt = new Date('2026-08-31T23:59:59.000Z');
    await h.client.ariaAccessGrant.createMany({
      data: [
        { id: 'db-active', studentId: student.id, featureKey: 'aria_maths', courseScopes: [], status: 'ACTIVE', startsAt: STARTED_AT, endsAt: null, ariaTier: 'ARIA_AUTONOMIE' },
        { id: 'db-expired', studentId: student.id, featureKey: 'aria_nsi', courseScopes: ['nsi-terminale-eds'], status: 'EXPIRED', startsAt: STARTED_AT, endsAt: endedAt, ariaTier: 'ARIA_SUIVI' },
        { id: 'db-revoked', studentId: student.id, featureKey: 'aria_maths', courseScopes: [], status: 'REVOKED', startsAt: STARTED_AT, endsAt: null, ariaTier: 'ARIA_ACCOMPAGNEE' },
      ],
    });

    const rows = await loadCoreV2AriaAccessGrants(h.client, student.id);
    expect(rows.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: 'db-active', featureKey: 'aria_maths', courseScopes: [], status: 'ACTIVE', startsAt: STARTED_AT, endsAt: null, ariaTier: 'ARIA_AUTONOMIE' },
      { id: 'db-expired', featureKey: 'aria_nsi', courseScopes: ['nsi-terminale-eds'], status: 'EXPIRED', startsAt: STARTED_AT, endsAt: endedAt, ariaTier: 'ARIA_SUIVI' },
      { id: 'db-revoked', featureKey: 'aria_maths', courseScopes: [], status: 'REVOKED', startsAt: STARTED_AT, endsAt: null, ariaTier: 'ARIA_ACCOMPAGNEE' },
    ]);
  });

  test('repository resolution delegates validity to the canonical kernel', async () => {
    const student = await seedStudent();
    await h.client.ariaAccessGrant.createMany({
      data: [
        { id: 'active-autonomie', studentId: student.id, featureKey: 'aria_maths', status: 'ACTIVE', startsAt: STARTED_AT, ariaTier: 'ARIA_AUTONOMIE' },
        { id: 'expired-accompagnee', studentId: student.id, featureKey: 'aria_nsi', status: 'EXPIRED', startsAt: STARTED_AT, ariaTier: 'ARIA_ACCOMPAGNEE' },
        { id: 'revoked-accompagnee', studentId: student.id, featureKey: 'aria_maths', status: 'REVOKED', startsAt: STARTED_AT, ariaTier: 'ARIA_ACCOMPAGNEE' },
      ],
    });

    const result = await resolveCoreV2AriaEntitlements(h.client, student.id, NOW);
    expect(result.aggregate).toMatchObject({ tier: 'ARIA_AUTONOMIE', grantIds: ['active-autonomie'] });
    expect(result.features).toEqual(['aria_maths']);
    expect(result.capabilities).toMatchObject({ chat: true, parentReporting: false, liveSupport: false });
  });
});
