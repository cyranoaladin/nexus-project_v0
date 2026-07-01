/**
 * API integration tests for /api/admin/config
 *
 * Tests the PATCH → invalidateSnapshot → GET chain to prove the admin
 * sees the new value immediately after write.
 */
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/admin/config/route';
import { _resetForTest, _setForTest, getOverride, type ConfigEntry } from '@/lib/config/snapshot';
import { SCHEMA_VERSION } from '@/lib/config/schemas';

// Mock auth: ADMIN user
jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn().mockResolvedValue({
    user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
  }),
  requireAnyRole: jest.fn().mockResolvedValue({
    user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
  }),
  isErrorResponse: jest.fn().mockReturnValue(false),
}));

// Mock prisma
const mockFindMany = jest.fn().mockResolvedValue([]);
const mockFindUnique = jest.fn().mockResolvedValue(null);
const mockUpsert = jest.fn();

// Serialization lock for test: simulates pg_advisory_xact_lock behavior.
// Only one $transaction callback runs at a time (queued).
let txLock: Promise<void> = Promise.resolve();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    businessConfig: {
      findMany: (...args: any[]) => mockFindMany(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
      upsert: (...args: any[]) => mockUpsert(...args),
    },
    $transaction: (fn: (tx: any) => Promise<any>) => {
      // Serialize: each transaction waits for the previous to complete
      const prev = txLock;
      let resolveLock: () => void;
      txLock = new Promise((r) => { resolveLock = r; });
      return prev.then(() =>
        fn({
          $queryRawUnsafe: async () => {}, // advisory lock no-op in test
          businessConfig: {
            findMany: (...args: any[]) => mockFindMany(...args),
            findUnique: (...args: any[]) => mockFindUnique(...args),
            upsert: (...args: any[]) => mockUpsert(...args),
          },
          businessConfigAudit: {
            create: async () => ({ id: 'audit-1' }),
          },
        }).finally(() => resolveLock!()),
      );
    },
  },
}));

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  _resetForTest();
  mockFindMany.mockResolvedValue([]);
  mockFindUnique.mockResolvedValue(null);
  mockUpsert.mockReset();
});

describe('PATCH /api/admin/config', () => {
  it('rejects invalid value (group_max: -3)', async () => {
    const res = await PATCH(makeRequest({
      namespace: 'pricing.rules',
      key: 'group_max',
      value: -3,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('rejects invariant violation (group_min_open.lycee > group_max)', async () => {
    // Snapshot has group_max=3
    _setForTest([{
      namespace: 'pricing.rules', key: 'group_max', value: 3,
      schemaVersion: SCHEMA_VERSION, version: 1, updatedBy: 'test', updatedAt: new Date(),
    }]);

    const res = await PATCH(makeRequest({
      namespace: 'pricing.rules',
      key: 'group_min_open.lycee',
      value: 5,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invariant violation');
    expect(body.violations[0]).toContain('group_min_open.lycee (5) > group_max (3)');
  });

  it('rejects discount above cap (bidirectional invariant)', async () => {
    _setForTest([{
      namespace: 'pricing.rules', key: 'discounts.global_cap_pct', value: 10,
      schemaVersion: SCHEMA_VERSION, version: 1, updatedBy: 'test', updatedAt: new Date(),
    }]);

    const res = await PATCH(makeRequest({
      namespace: 'pricing.rules',
      key: 'discounts.comptant_pct',
      value: 15,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.violations[0]).toContain('global_cap_pct (10) < discounts.comptant_pct (15)');
  });

  it('PATCH then GET sees the new value (applyWrite is synchronous)', async () => {
    const upsertedRow = {
      id: 'cfg-1', namespace: 'pricing.rules', key: 'group_max', value: 3,
      schemaVersion: SCHEMA_VERSION, version: 1, previousValue: null,
      updatedBy: 'admin-1', updatedAt: new Date(), createdAt: new Date(),
    };
    mockUpsert.mockResolvedValue(upsertedRow);

    const patchRes = await PATCH(makeRequest({
      namespace: 'pricing.rules',
      key: 'group_max',
      value: 3,
    }));
    expect(patchRes.status).toBe(200);

    // GET immediately after PATCH — must see group_max=3
    const getRes = await GET();
    const body = await getRes.json();
    expect(body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ namespace: 'pricing.rules', key: 'group_max', value: 3 }),
      ]),
    );

    // Also verify via getOverride (sync accessor)
    expect(getOverride('pricing.rules', 'group_max')).toBe(3);
  });

  it('rejects missing fields', async () => {
    const res = await PATCH(makeRequest({ namespace: 'pricing.rules' }));
    expect(res.status).toBe(400);
  });

  it('rejects unknown namespace', async () => {
    const res = await PATCH(makeRequest({
      namespace: 'unknown.ns',
      key: 'foo',
      value: 1,
    }));
    expect(res.status).toBe(400);
  });
});

describe('TOCTOU — concurrent cross-key invariant bypass', () => {
  it('two concurrent PATCHes on related keys cannot bypass group_min ≤ group_max', async () => {
    // Initial state: group_max=5, group_min_open.lycee=3 (valid: 3 ≤ 5)
    const dbState: Record<string, { value: unknown; version: number }> = {
      'pricing.rules::group_max': { value: 5, version: 1 },
      'pricing.rules::group_min_open.lycee': { value: 3, version: 1 },
    };

    _setForTest([
      { namespace: 'pricing.rules', key: 'group_max', value: 5,
        schemaVersion: SCHEMA_VERSION, version: 1, updatedBy: 'test', updatedAt: new Date() },
      { namespace: 'pricing.rules', key: 'group_min_open.lycee', value: 3,
        schemaVersion: SCHEMA_VERSION, version: 1, updatedBy: 'test', updatedAt: new Date() },
    ]);

    // Mock findMany reads from dbState (transactional view)
    mockFindMany.mockImplementation(async () => {
      return Object.entries(dbState).map(([mapKey, { value, version }]) => {
        const [ns, key] = mapKey.split('::');
        return {
          id: mapKey, namespace: ns, key, value,
          schemaVersion: SCHEMA_VERSION, version, previousValue: null,
          updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date(),
        };
      });
    });

    mockFindUnique.mockImplementation(async (args: any) => {
      const ns = args.where.namespace_key.namespace;
      const key = args.where.namespace_key.key;
      const state = dbState[`${ns}::${key}`];
      if (!state) return null;
      return {
        id: `${ns}::${key}`, namespace: ns, key, value: state.value,
        schemaVersion: SCHEMA_VERSION, version: state.version, previousValue: null,
        updatedBy: 'admin', updatedAt: new Date(), createdAt: new Date(),
      };
    });

    mockUpsert.mockImplementation(async (args: any) => {
      const key = args.where.namespace_key.key;
      const ns = args.where.namespace_key.namespace;
      const value = args.update?.value ?? args.create?.value;
      const mapKey = `${ns}::${key}`;
      const existing = dbState[mapKey];
      const newVersion = (existing?.version ?? 0) + 1;
      dbState[mapKey] = { value, version: newVersion };
      return {
        id: mapKey, namespace: ns, key, value,
        schemaVersion: SCHEMA_VERSION, version: newVersion, previousValue: existing?.value ?? null,
        updatedBy: 'admin-1', updatedAt: new Date(), createdAt: new Date(),
      };
    });

    // Fire both PATCHes concurrently. Due to the serialized $transaction
    // mock, they execute one after the other — the second one sees the
    // first's committed state in its transactional findMany.
    const [resA, resB] = await Promise.all([
      PATCH(makeRequest({ namespace: 'pricing.rules', key: 'group_max', value: 4 })),
      PATCH(makeRequest({ namespace: 'pricing.rules', key: 'group_min_open.lycee', value: 5 })),
    ]);

    // The serialized lock means: A commits first (group_max=4), then B
    // validates inside the transaction seeing group_max=4 and lycee=5 → 5>4 → rejected.
    // At least one MUST be rejected (400).
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toContain(400);
  });
});
