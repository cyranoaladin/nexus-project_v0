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

jest.mock('@/lib/prisma', () => ({
  prisma: {
    businessConfig: {
      findMany: (...args: any[]) => mockFindMany(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
      upsert: (...args: any[]) => mockUpsert(...args),
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

  it('PATCH then GET sees the new value (invalidation is synchronous)', async () => {
    const upsertedRow = {
      id: 'cfg-1', namespace: 'pricing.rules', key: 'group_max', value: 3,
      schemaVersion: SCHEMA_VERSION, version: 1, previousValue: null,
      updatedBy: 'admin-1', updatedAt: new Date(), createdAt: new Date(),
    };
    mockUpsert.mockResolvedValue(upsertedRow);
    // After PATCH commits, invalidateSnapshot() calls findMany:
    mockFindMany.mockResolvedValue([upsertedRow]);

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
