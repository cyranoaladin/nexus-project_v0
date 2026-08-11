import { assertDisposableE2eDatabase } from '@/e2e/helpers/disposable-database';

describe('disposable E2E database guard', () => {
  const originalMarker = process.env.E2E_DISPOSABLE_STACK;

  afterEach(() => {
    if (originalMarker === undefined) delete process.env.E2E_DISPOSABLE_STACK;
    else process.env.E2E_DISPOSABLE_STACK = originalMarker;
  });

  it('requires an explicit disposable-stack marker', () => {
    delete process.env.E2E_DISPOSABLE_STACK;
    expect(() => assertDisposableE2eDatabase(
      'postgresql://test:test@localhost:5435/nexus_e2e?schema=public',
    )).toThrow('E2E_DATABASE_NOT_DISPOSABLE');
  });

  it('accepts only the dedicated E2E database on an allowed local host', () => {
    process.env.E2E_DISPOSABLE_STACK = '1';
    expect(assertDisposableE2eDatabase(
      'postgresql://test:test@postgres-e2e:5432/nexus_e2e?schema=public',
    ).pathname).toBe('/nexus_e2e');
    expect(() => assertDisposableE2eDatabase(
      'postgresql://test:test@localhost:5432/nexus_disposable_test?schema=public',
    )).toThrow('E2E_DATABASE_NOT_DISPOSABLE');
  });
});
