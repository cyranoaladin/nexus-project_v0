import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadWaveManifest } from '@/lib/bilans/catalog/wave-manifest';

function packAccess(): typeof import('@/lib/bilans/api/pack-access') {
  return require('@/lib/bilans/api/pack-access');
}

function access(): typeof import('@/lib/bilans/api/access') {
  return require('@/lib/bilans/api/access');
}

function idempotency(): typeof import('@/lib/bilans/api/idempotency') {
  return require('@/lib/bilans/api/idempotency');
}

function memoryIdempotencyDatabase() {
  let records = new Map<string, any>();
  const coordinate = (value: { userId: string; route: string; key: string }) => (
    `${value.userId}\u0000${value.route}\u0000${value.key}`
  );
  const delegate = {
    findUnique: jest.fn(async ({ where }: any) => records.get(coordinate(where.userId_route_key)) ?? null),
    deleteMany: jest.fn(async ({ where }: any) => {
      const id = coordinate(where);
      const record = records.get(id);
      if (record && record.expiresAt <= where.expiresAt.lte) records.delete(id);
      return { count: record ? 1 : 0 };
    }),
    create: jest.fn(async ({ data }: any) => {
      const id = coordinate(data);
      if (records.has(id)) throw Object.assign(new Error('unique'), { code: 'P2002' });
      records.set(id, { ...data, response: null, responseStatus: null });
      return records.get(id);
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const id = coordinate(where.userId_route_key);
      records.set(id, { ...records.get(id), ...data });
      return records.get(id);
    }),
  };
  const database = {
    canonicalApiIdempotencyKey: delegate,
    $transaction: jest.fn(async (operation: (tx: any) => Promise<unknown>) => {
      const snapshot = new Map([...records].map(([key, value]) => [key, { ...value }]));
      try {
        return await operation({ canonicalApiIdempotencyKey: delegate });
      } catch (error) {
        records = snapshot;
        throw error;
      }
    }),
  };
  return { database, records: () => records };
}

describe('A85.1 Canonical API foundations', () => {
  test('discovers every converted active pack from the versioned catalogue', () => {
    const { listResolvablePackSlugs, resolveCatalogPackPath } = packAccess();
    const manifest = loadWaveManifest('data/bilans/banks/wave1.manifest.json');
    const expected = manifest.banks.map(({ slug }) => slug).sort();

    expect(listResolvablePackSlugs()).toEqual(expected);
    expect(listResolvablePackSlugs()).toHaveLength(manifest.expectedActiveBanks);
    for (const entry of manifest.banks) {
      expect(resolveCatalogPackPath(entry.slug)).toBe(entry.output);
    }
    expect(resolveCatalogPackPath('maths-terminale-bilan-v1')).toBeNull();
  });

  test('keeps every pack flag off unless that exact validated pack is explicitly true', () => {
    const { isPackEnabled, packFeatureFlagName } = packAccess();
    const validated = {
      slug: 'entree-terminale-maths-v1',
      status: 'VALIDATED',
      review: { validatedBy: 'Enseignant', validatedAt: '2026-08-02T10:00:00.000Z' },
    } as const;
    const draft = { ...validated, status: 'DRAFT', review: { validatedBy: null, validatedAt: null } } as const;
    const flag = packFeatureFlagName(validated.slug);

    expect(isPackEnabled(validated, {})).toBe(false);
    expect(isPackEnabled(validated, { [flag]: 'invalid' })).toBe(false);
    expect(isPackEnabled(draft, { [flag]: 'true' })).toBe(false);
    expect(isPackEnabled(validated, { [flag]: 'true' })).toBe(true);
    expect(isPackEnabled({ ...validated, slug: 'entree-premiere-maths-v1' }, { [flag]: 'true' })).toBe(false);
  });

  test('fails closed through the shared attempt pack guard', () => {
    const { assertAttemptPackEnabled } = packAccess();
    const enabled = { pack: { slug: 'entree-terminale-maths-v1', version: 1 } };
    const resolvePack = jest.fn().mockReturnValue(enabled);
    const attempt = {
      assessmentPackId: 'entree-terminale-maths-v1',
      assessmentPackVersion: '1',
    };

    expect(assertAttemptPackEnabled(attempt, resolvePack)).toBe(enabled);
    expect(resolvePack).toHaveBeenCalledWith('entree-terminale-maths-v1', 1);
    expect(() => assertAttemptPackEnabled(attempt, () => null)).toThrow('NOT_FOUND');
    expect(() => assertAttemptPackEnabled(
      { ...attempt, assessmentPackVersion: 'invalid' },
      resolvePack,
    )).toThrow('NOT_FOUND');
  });

  test('resolves an ELEVE Student from session userId without any email fallback', async () => {
    const { resolveSessionStudent } = access();
    const findUnique = jest.fn().mockResolvedValue({
      id: 'student-1',
      userId: 'user-1',
      gradeLevel: 'SECONDE',
    });
    const student = await resolveSessionStudent(
      { user: { id: 'user-1', role: 'ELEVE', email: 'ignored@example.test' } } as never,
      { student: { findUnique } } as never,
    );

    expect(student).toEqual({ id: 'student-1', userId: 'user-1', gradeLevel: 'SECONDE' });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { id: true, userId: true, gradeLevel: true },
    });
    expect(JSON.stringify(findUnique.mock.calls)).not.toContain('ignored@example.test');
  });

  test('uses 401 for a missing session and 404 for every authenticated access denial', () => {
    const { CanonicalApiError } = access();

    expect(CanonicalApiError.unauthenticated().status).toBe(401);
    for (const denial of [
      CanonicalApiError.notFound(),
      CanonicalApiError.studentRequired(),
      CanonicalApiError.audienceDenied(),
    ]) {
      expect(denial.status).toBe(404);
      expect(denial.status).not.toBe(403);
    }
  });

  test('bounds persistent idempotency to 24 hours and rejects malformed keys', () => {
    const { idempotencyExpiresAt, parseIdempotencyKey } = idempotency();
    const now = new Date('2026-08-02T10:00:00.000Z');

    expect(idempotencyExpiresAt(now).toISOString()).toBe('2026-08-03T10:00:00.000Z');
    expect(parseIdempotencyKey('request-123456')).toBe('request-123456');
    expect(() => parseIdempotencyKey(null)).toThrow('IDEMPOTENCY_KEY_REQUIRED');
    expect(() => parseIdempotencyKey('bad key')).toThrow('IDEMPOTENCY_KEY_INVALID');
  });

  test('replays a committed response and does not retain a failed transaction', async () => {
    const { executeIdempotently } = idempotency();
    const now = new Date('2026-08-02T10:00:00.000Z');
    const first = memoryIdempotencyDatabase();
    const action = jest.fn(async () => ({ status: 201 as const, body: { attemptId: 'attempt-1' } }));
    const input = {
      prisma: first.database as never,
      userId: 'user-1',
      route: 'POST:/api/bilans/attempts',
      key: 'request-123456',
      now,
      action,
    };

    await expect(executeIdempotently(input)).resolves.toMatchObject({ replayed: false, status: 201 });
    await expect(executeIdempotently(input)).resolves.toEqual({
      replayed: true,
      status: 201,
      body: { attemptId: 'attempt-1' },
    });
    expect(action).toHaveBeenCalledTimes(1);

    const failed = memoryIdempotencyDatabase();
    const failingAction = jest.fn()
      .mockRejectedValueOnce(new Error('transaction failed'))
      .mockResolvedValueOnce({ status: 200, body: { revision: 1 } });
    const retryInput = { ...input, prisma: failed.database as never, action: failingAction };
    await expect(executeIdempotently(retryInput)).rejects.toThrow('transaction failed');
    expect(failed.records().size).toBe(0);
    await expect(executeIdempotently(retryInput)).resolves.toMatchObject({ replayed: false, status: 200 });
    expect(failingAction).toHaveBeenCalledTimes(2);
  });

  test('persists optimistic revision and unique idempotency coordinates additively', () => {
    const migrationPath = resolve(
      process.cwd(),
      'prisma/migrations/20260802140000_add_canonical_api_idempotency/migration.sql',
    );

    expect(existsSync(migrationPath)).toBe(true);
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const migration = readFileSync(migrationPath, 'utf8');
    expect(schema).toMatch(/revision\s+Int\s+@default\(0\)/);
    expect(schema).toContain('model CanonicalApiIdempotencyKey');
    expect(schema).toMatch(/@@unique\(\[userId, route, key\](?:,\s*map:\s*"[^"]+")?\)/);
    expect(migration).toContain('UNIQUE ("userId", "route", "key")');
    expect(migration).toContain('"expiresAt" TIMESTAMP(3) NOT NULL');
    expect(migration).not.toMatch(/\b(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE|RENAME)\b/i);
  });
});
