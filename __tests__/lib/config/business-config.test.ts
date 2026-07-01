/**
 * BusinessConfig — snapshot + Zod validation + invariants.
 *
 * Each test PROVES a specific guarantee by execution, not assertion of intent.
 */
import {
  getOverride,
  getOverrideOr,
  applyWrite,
  _resetForTest,
  _setForTest,
  type ConfigEntry,
} from '@/lib/config/snapshot';
import {
  validateConfigEntry,
  validateCrossInvariants,
  getCurrentMinPrice,
  SCHEMA_VERSION,
} from '@/lib/config/schemas';

function makeEntry(ns: string, key: string, value: unknown, version = 1): ConfigEntry {
  return {
    namespace: ns,
    key,
    value,
    schemaVersion: SCHEMA_VERSION,
    version,
    updatedBy: 'test',
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  _resetForTest();
});

// ── Snapshot basics ──

describe('snapshot — getOverride / getOverrideOr', () => {
  it('returns null when store is empty', () => {
    expect(getOverride('pricing.rules', 'group_max')).toBeNull();
  });

  it('returns the value when entry exists', () => {
    _setForTest([makeEntry('pricing.rules', 'group_max', 3)]);
    expect(getOverride('pricing.rules', 'group_max')).toBe(3);
  });

  it('getOverrideOr returns fallback when no override', () => {
    expect(getOverrideOr('pricing.rules', 'group_max', 5)).toBe(5);
  });

  it('getOverrideOr returns override when present', () => {
    _setForTest([makeEntry('pricing.rules', 'group_max', 3)]);
    expect(getOverrideOr('pricing.rules', 'group_max', 5)).toBe(3);
  });
});

// ── Per-key Zod validation ──

describe('validateConfigEntry — per-key', () => {
  it('accepts valid group_max', () => {
    expect(validateConfigEntry('pricing.rules', 'group_max', 5)).toEqual({ valid: true });
  });

  it('rejects group_max: -3 (below min)', () => {
    const result = validateConfigEntry('pricing.rules', 'group_max', -3);
    expect(result.valid).toBe(false);
  });

  it('rejects group_max: "five" (wrong type)', () => {
    const result = validateConfigEntry('pricing.rules', 'group_max', 'five');
    expect(result.valid).toBe(false);
  });

  it('rejects unknown namespace', () => {
    const result = validateConfigEntry('unknown.ns', 'foo', 1);
    expect(result.valid).toBe(false);
  });

  it('rejects unknown key in known namespace', () => {
    const result = validateConfigEntry('pricing.rules', 'nonexistent_key', 1);
    expect(result.valid).toBe(false);
  });

  it('accepts products.credits with any productCode', () => {
    expect(validateConfigEntry('products.credits', 'IMMERSION.grantsCredits', 8)).toEqual({ valid: true });
  });

  it('rejects products.credits with negative value', () => {
    const result = validateConfigEntry('products.credits', 'IMMERSION.grantsCredits', -1);
    expect(result.valid).toBe(false);
  });
});

// ── Invariant 3: group_min_open ≤ group_max ──

describe('invariant 3 — group_min_open ≤ group_max', () => {
  it('rejects group_min_open.lycee: 5 when group_max is 3', () => {
    // Set group_max to 3 in the snapshot
    _setForTest([makeEntry('pricing.rules', 'group_max', 3)]);
    // Attempt to write group_min_open.lycee: 5 → must violate
    const violations = validateCrossInvariants('pricing.rules', 'group_min_open.lycee', 5);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('group_min_open.lycee (5) > group_max (3)');
  });

  it('rejects group_max: 2 when group_min_open.lycee is already 3', () => {
    // Symmetric: lowering group_max below existing min_open
    _setForTest([makeEntry('pricing.rules', 'group_min_open.lycee', 3)]);
    const violations = validateCrossInvariants('pricing.rules', 'group_max', 2);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('group_min_open.lycee (3) > group_max (2)');
  });

  it('accepts group_min_open.lycee: 3 when group_max is 5', () => {
    _setForTest([makeEntry('pricing.rules', 'group_max', 5)]);
    const violations = validateCrossInvariants('pricing.rules', 'group_min_open.lycee', 3);
    expect(violations).toEqual([]);
  });
});

// ── Invariant 4: global_cap_pct ≥ max discount — bidirectional ──

describe('invariant 4 — global_cap_pct ≥ individual discounts (bidirectional)', () => {
  it('rejects lowering global_cap below existing discount', () => {
    _setForTest([makeEntry('pricing.rules', 'discounts.comptant_pct', 15)]);
    const violations = validateCrossInvariants('pricing.rules', 'discounts.global_cap_pct', 10);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('global_cap_pct (10) < discounts.comptant_pct (15)');
  });

  it('rejects raising a discount above existing cap', () => {
    _setForTest([makeEntry('pricing.rules', 'discounts.global_cap_pct', 10)]);
    const violations = validateCrossInvariants('pricing.rules', 'discounts.comptant_pct', 15);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('global_cap_pct (10) < discounts.comptant_pct (15)');
  });

  it('accepts discount within cap', () => {
    _setForTest([makeEntry('pricing.rules', 'discounts.global_cap_pct', 20)]);
    const violations = validateCrossInvariants('pricing.rules', 'discounts.comptant_pct', 15);
    expect(violations).toEqual([]);
  });
});

// ── Invariant 1: discount min ≤ max ──

describe('invariant 1 — discount min ≤ max', () => {
  it('rejects ancien_eleve_min > ancien_eleve_max', () => {
    _setForTest([makeEntry('pricing.rules', 'discounts.ancien_eleve_max_pct', 10)]);
    const violations = validateCrossInvariants('pricing.rules', 'discounts.ancien_eleve_min_pct', 15);
    expect(violations.length).toBeGreaterThan(0);
  });
});

// ── Invariant 5: deposit viability at floor price ──

describe('invariant 5 — deposit viability at floor price', () => {
  it('rejects lowering a floor so deposit rounds to 0', () => {
    // deposit_pct=30%, rounding=10 → floor=1 → deposit = round(1*30/100/10)*10 = 0
    _setForTest([
      makeEntry('pricing.rules', 'payment.deposit_pct', 30),
      makeEntry('pricing.rules', 'payment.rounding_tnd', 10),
    ]);
    const violations = validateCrossInvariants('pricing.floors', 'single', 1);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('deposit rounds to 0');
  });

  it('rejects deposit exceeding floor price', () => {
    // deposit_pct=90%, rounding=10 → floor=8 → deposit = round(8*90/100/10)*10 = round(0.72)*10 = 10 > 8
    _setForTest([
      makeEntry('pricing.rules', 'payment.deposit_pct', 90),
      makeEntry('pricing.rules', 'payment.rounding_tnd', 10),
    ]);
    const violations = validateCrossInvariants('pricing.floors', 'single', 8);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('exceeds floor price');
  });

  it('accepts viable floor/deposit combination', () => {
    _setForTest([
      makeEntry('pricing.rules', 'payment.deposit_pct', 30),
      makeEntry('pricing.rules', 'payment.rounding_tnd', 10),
    ]);
    const violations = validateCrossInvariants('pricing.floors', 'single', 50);
    // deposit = round(50*30/100/10)*10 = round(1.5)*10 = 20 → 0 < 20 ≤ 50 ✓
    expect(violations).toEqual([]);
  });
});

// ── Load-time validation: invalid entries discarded ──

describe('snapshot — load-time validation discards invalid entries (REAL path)', () => {
  it('loadConfigSnapshot discards invalid DB entries, keeps valid ones', async () => {
    const snapshotModule = await import('@/lib/config/snapshot');
    const prismaModule = await import('@/lib/prisma');
    const origFindMany = prismaModule.prisma.businessConfig.findMany;
    snapshotModule._resetForTest();

    // Mock DB returns one valid and one invalid entry
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => [
      { id: '1', namespace: 'pricing.rules', key: 'group_max', value: 5,
        schemaVersion: '1.0', version: 1, previousValue: null,
        updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date() },
      { id: '2', namespace: 'pricing.rules', key: 'group_max', value: -3, // INVALID
        schemaVersion: '1.0', version: 2, previousValue: null,
        updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date() },
    ]);

    await snapshotModule.loadConfigSnapshot();

    // The invalid entry (value=-3) should have been discarded.
    // The valid entry (value=5) would have been overwritten by the invalid
    // one if both had the same key. Since they DO have the same key,
    // the Map uses the last one. But the invalid one is filtered → the
    // valid one (v=5) is kept IF it was seen first. Let's use different keys:
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => [
      { id: '1', namespace: 'pricing.rules', key: 'group_max', value: 5,
        schemaVersion: '1.0', version: 1, previousValue: null,
        updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date() },
      { id: '2', namespace: 'pricing.rules', key: 'group_min_open.lycee', value: -3, // INVALID
        schemaVersion: '1.0', version: 1, previousValue: null,
        updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date() },
    ]);

    snapshotModule._resetForTest();
    await snapshotModule.loadConfigSnapshot();

    // Valid entry is in snapshot
    expect(snapshotModule.getOverride('pricing.rules', 'group_max')).toBe(5);
    // Invalid entry was discarded
    expect(snapshotModule.getOverride('pricing.rules', 'group_min_open.lycee')).toBeNull();

    (prismaModule.prisma.businessConfig as any).findMany = origFindMany;
    snapshotModule._resetForTest();
  });
});

// ── getCurrentMinPrice dynamic computation ──

describe('getCurrentMinPrice — dynamic from overrides + fallbacks', () => {
  it('returns min of static floors when no overrides', () => {
    const floors = { single: 50, multi: 45, college: 40 };
    expect(getCurrentMinPrice(floors)).toBe(40);
  });

  it('uses override when present', () => {
    _setForTest([makeEntry('pricing.floors', 'college', 30)]);
    const floors = { single: 50, multi: 45, college: 40 };
    expect(getCurrentMinPrice(floors)).toBe(30);
  });

  it('mixes overrides and fallbacks', () => {
    _setForTest([makeEntry('pricing.floors', 'single', 20)]);
    const floors = { single: 50, multi: 45, college: 40 };
    // Override single=20, fallback multi=45, college=40 → min=20
    expect(getCurrentMinPrice(floors)).toBe(20);
  });
});

// ── applyWrite ordering tests ──
// applyWrite uses the DB version as order authority. No findMany race.

describe('snapshot — applyWrite version-based ordering', () => {
  it('two concurrent writes: higher version wins regardless of call order', () => {
    // Admin A commits version=2 (group_max=3), admin B commits version=3 (group_max=7).
    // Even if A's applyWrite is called AFTER B's, B wins (version 3 > 2).
    applyWrite(makeEntry('pricing.rules', 'group_max', 7, 3)); // B first
    applyWrite(makeEntry('pricing.rules', 'group_max', 3, 2)); // A second — lower version

    expect(getOverride('pricing.rules', 'group_max')).toBe(7); // B wins
  });

  it('P1-a: old write fast + new write slow — new write wins by version', () => {
    // A (old, version=2, value=3) applies first.
    // B (new, version=3, value=7) applies second.
    // B has higher version → wins.
    applyWrite(makeEntry('pricing.rules', 'group_max', 3, 2));
    expect(getOverride('pricing.rules', 'group_max')).toBe(3);

    applyWrite(makeEntry('pricing.rules', 'group_max', 7, 3));
    expect(getOverride('pricing.rules', 'group_max')).toBe(7);
  });

  it('applyWrite with lower version than snapshot is discarded', () => {
    applyWrite(makeEntry('pricing.rules', 'group_max', 7, 3));
    applyWrite(makeEntry('pricing.rules', 'group_max', 5, 1)); // stale version

    expect(getOverride('pricing.rules', 'group_max')).toBe(7); // v3 kept
  });

  it('applyWrite rejects invalid value (defense in depth)', () => {
    applyWrite(makeEntry('pricing.rules', 'group_max', -3, 1)); // invalid
    expect(getOverride('pricing.rules', 'group_max')).toBeNull(); // not applied
  });
});

// ── Passive vs applyWrite race ──

describe('snapshot — passive load does not overwrite applyWrite', () => {
  let snapshotModule: typeof import('@/lib/config/snapshot');
  let prismaModule: typeof import('@/lib/prisma');
  let origFindMany: any;

  beforeEach(async () => {
    snapshotModule = await import('@/lib/config/snapshot');
    prismaModule = await import('@/lib/prisma');
    origFindMany = prismaModule.prisma.businessConfig.findMany;
    snapshotModule._resetForTest();
  });

  afterEach(() => {
    (prismaModule.prisma.businessConfig as any).findMany = origFindMany;
    snapshotModule._resetForTest();
  });

  function mockRow(key: string, value: unknown, version = 1) {
    return {
      id: '1', namespace: 'pricing.rules', key, value,
      schemaVersion: '1.0', version, previousValue: null,
      updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date(),
    };
  }

  it('stale passive does not overwrite a newer applyWrite', async () => {
    // Passive starts slow findMany (50ms, returns stale v1=5).
    // While passive is in-flight, admin commits v2=3 and calls applyWrite.
    // Passive finishes → swapSequence changed → passive cedes.
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return [mockRow('group_max', 5, 1)]; // stale
    });

    const passive = snapshotModule.loadConfigSnapshot();
    await new Promise((r) => setTimeout(r, 10));

    // Admin commits and applies directly — synchronous, no race
    snapshotModule.applyWrite({
      namespace: 'pricing.rules', key: 'group_max', value: 3,
      schemaVersion: '1.0', version: 2, updatedBy: 'admin', updatedAt: new Date(),
    });
    expect(snapshotModule.getOverride('pricing.rules', 'group_max')).toBe(3);

    await passive; // passive finishes with stale v1

    // Passive must NOT have overwritten the applyWrite value
    expect(snapshotModule.getOverride('pricing.rules', 'group_max')).toBe(3);
  });

  it('fast passive + later applyWrite → applyWrite wins', async () => {
    // Passive finishes quickly (v1=5), then admin commits v2=3.
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => {
      return [mockRow('group_max', 5, 1)];
    });

    await snapshotModule.loadConfigSnapshot();
    expect(snapshotModule.getOverride('pricing.rules', 'group_max')).toBe(5);

    // Admin commits v2=3
    snapshotModule.applyWrite({
      namespace: 'pricing.rules', key: 'group_max', value: 3,
      schemaVersion: '1.0', version: 2, updatedBy: 'admin', updatedAt: new Date(),
    });
    expect(snapshotModule.getOverride('pricing.rules', 'group_max')).toBe(3);
  });
});

// Same-ms resolution test REMOVED: the swapSequence counter is an integer,
// not a timestamp. Two loads in the same ms have distinct sequence captures
// by construction (each swap increments the counter synchronously).
// No test needed — the property is structural, not behavioral.

// ── Point 3: passive losing guard doesn't storm findMany ──

describe('snapshot — passive losing guard advances lastLoadedAt', () => {
  let snapshotModule: typeof import('@/lib/config/snapshot');
  let prismaModule: typeof import('@/lib/prisma');
  let origFindMany: any;

  beforeEach(async () => {
    snapshotModule = await import('@/lib/config/snapshot');
    prismaModule = await import('@/lib/prisma');
    origFindMany = prismaModule.prisma.businessConfig.findMany;
    snapshotModule._resetForTest();
  });

  afterEach(() => {
    (prismaModule.prisma.businessConfig as any).findMany = origFindMany;
    snapshotModule._resetForTest();
  });

  function mockRow(value: unknown) {
    return {
      id: '1', namespace: 'pricing.rules', key: 'group_max', value,
      schemaVersion: '1.0', version: 1, previousValue: null,
      updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date(),
    };
  }

  it('passive that loses the guard still prevents TTL re-trigger', async () => {
    let findManyCallCount = 0;
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => {
      findManyCallCount++;
      if (findManyCallCount === 1) {
        // Slow passive
        await new Promise((r) => setTimeout(r, 30));
        return [mockRow(5)]; // stale
      }
      return [mockRow(3)]; // post-write
    });

    // Start passive
    const passive = snapshotModule.loadConfigSnapshot();
    // applyWrite wins while passive is slow
    await new Promise((r) => setTimeout(r, 5));
    snapshotModule.applyWrite({
      namespace: 'pricing.rules', key: 'group_max', value: 3,
      schemaVersion: '1.0', version: 2, updatedBy: 'admin', updatedAt: new Date(),
    });
    await passive;

    // Passive lost the guard. But it should have advanced lastLoadedAt.
    // So ensureFresh() should NOT re-trigger immediately:
    findManyCallCount = 0;
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => {
      findManyCallCount++;
      return [mockRow(3)];
    });

    await snapshotModule.ensureFresh();
    // ensureFresh should be a no-op (within TTL), so no new findMany call
    expect(findManyCallCount).toBe(0);
  });
});

// ── Nominal TTL refresh — tested with mocked clock ──

describe('snapshot — nominal TTL refresh (mocked clock, no reset)', () => {
  let snapshotModule: typeof import('@/lib/config/snapshot');
  let prismaModule: typeof import('@/lib/prisma');
  let origFindMany: any;
  let origDateNow: typeof Date.now;

  beforeEach(async () => {
    snapshotModule = await import('@/lib/config/snapshot');
    prismaModule = await import('@/lib/prisma');
    origFindMany = prismaModule.prisma.businessConfig.findMany;
    origDateNow = Date.now;
    snapshotModule._resetForTest();
  });

  afterEach(() => {
    (prismaModule.prisma.businessConfig as any).findMany = origFindMany;
    Date.now = origDateNow;
    snapshotModule._resetForTest();
  });

  function mockRow(value: unknown) {
    return {
      id: '1', namespace: 'pricing.rules', key: 'group_max', value,
      schemaVersion: '1.0', version: 1, previousValue: null,
      updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date(),
    };
  }

  it('initial load → within TTL no-op → TTL expires → passive swaps new value', async () => {
    let fakeTime = 1000000;
    Date.now = () => fakeTime;

    // Step 1: initial load at T=1000000 with value 5
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => [mockRow(5)]);
    await snapshotModule.loadConfigSnapshot();
    expect(snapshotModule.getOverride('pricing.rules', 'group_max')).toBe(5);

    // Step 2: advance time 30s (within 60s TTL) — ensureFresh is a no-op
    fakeTime += 30_000;
    let freshCallCount = 0;
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => {
      freshCallCount++;
      return [mockRow(8)];
    });
    await snapshotModule.ensureFresh();
    expect(freshCallCount).toBe(0); // No DB call
    expect(snapshotModule.getOverride('pricing.rules', 'group_max')).toBe(5);

    // Step 3: advance time past TTL (total +61s from initial load)
    fakeTime += 31_000;
    (prismaModule.prisma.businessConfig as any).findMany = jest.fn(async () => [mockRow(8)]);
    await snapshotModule.ensureFresh();
    // The passive refresh should have swapped to 8
    expect(snapshotModule.getOverride('pricing.rules', 'group_max')).toBe(8);
  });
});

// ── Test helpers guarded in production ──

describe('snapshot — test helpers guarded in production', () => {
  function withProdEnv(fn: () => void) {
    const origEnv = process.env.NODE_ENV;
    // Use delete+assign to bypass @types/node readonly
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    try {
      fn();
    } finally {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
    }
  }

  it('_resetForTest throws when NODE_ENV=production', () => {
    withProdEnv(() => {
      expect(() => _resetForTest()).toThrow('not available in production');
    });
  });

  it('_setForTest throws when NODE_ENV=production', () => {
    withProdEnv(() => {
      expect(() => _setForTest([])).toThrow('not available in production');
    });
  });
});
