import { assertCoreV2E2eSeedTarget } from '@/scripts/core-v2/e2e-seed-target';

describe('Core v2 E2E seed target guard', () => {
  test.each([
    'postgresql://postgres@localhost:5435/core_v2_e2e',
    'postgres://postgres@127.0.0.1:5435/core_v2_e2e',
    'postgresql://postgres@[::1]:5435/core_v2_e2e',
    'postgresql://postgres@postgres-core-v2-e2e:5432/core_v2_e2e',
  ])('accepts the exact disposable harness target %s', (url) => {
    expect(() => assertCoreV2E2eSeedTarget({
      CORE_V2_DATABASE_URL: url,
      E2E_DISPOSABLE_STACK: '1',
    })).not.toThrow();
  });

  test('refuses a non-disposable target even when the marker is set, without leaking its URL', () => {
    const credentialSentinel = ['credential', 'must', 'stay', 'private'].join('-');
    const url = `postgresql://admin:${credentialSentinel}@production-db.internal:5432/nexus_core_v2`;

    let error: unknown;
    try {
      assertCoreV2E2eSeedTarget({ CORE_V2_DATABASE_URL: url, E2E_DISPOSABLE_STACK: '1' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('CORE_V2_E2E_SEED_TARGET_REFUSED');
    expect((error as Error).message).not.toContain(credentialSentinel);
    expect((error as Error).message).not.toContain('production-db.internal');
  });

  test.each([
    ['missing marker', 'postgresql://postgres@localhost:5435/core_v2_e2e', undefined],
    ['wrong database', 'postgresql://postgres@localhost:5435/nexus_prod', '1'],
    ['wrong local port', 'postgresql://postgres@localhost:5432/core_v2_e2e', '1'],
    ['neighbor IPv6 host', 'postgresql://postgres@[::2]:5435/core_v2_e2e', '1'],
    ['wrong compose port', 'postgresql://postgres@postgres-core-v2-e2e:5435/core_v2_e2e', '1'],
    ['host query override', 'postgresql://postgres@localhost:5435/core_v2_e2e?host=/var/run/postgresql', '1'],
    ['wrong protocol', 'mysql://root@localhost:5435/core_v2_e2e', '1'],
    ['malformed URL', 'not-a-url', '1'],
  ])('refuses %s', (_case, url, marker) => {
    expect(() => assertCoreV2E2eSeedTarget({
      CORE_V2_DATABASE_URL: url,
      E2E_DISPOSABLE_STACK: marker,
    })).toThrow('CORE_V2_E2E_SEED_TARGET_REFUSED');
  });
});
