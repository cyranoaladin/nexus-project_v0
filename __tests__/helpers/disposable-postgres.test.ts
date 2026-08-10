import { assertDisposablePostgresUrl } from './disposable-postgres';

describe('disposable PostgreSQL guard', () => {
  const originalMarker = process.env.NEXUS_DISPOSABLE_POSTGRES;

  afterEach(() => {
    if (originalMarker === undefined) delete process.env.NEXUS_DISPOSABLE_POSTGRES;
    else process.env.NEXUS_DISPOSABLE_POSTGRES = originalMarker;
  });

  it('refuses a local test-looking database without an explicit disposable marker', () => {
    delete process.env.NEXUS_DISPOSABLE_POSTGRES;

    expect(() => assertDisposablePostgresUrl(
      'postgresql://test:test@localhost:5432/nexus_test?schema=public',
    )).toThrow();
  });

  it('accepts the dedicated disposable database only with the explicit marker', () => {
    process.env.NEXUS_DISPOSABLE_POSTGRES = '1';

    expect(assertDisposablePostgresUrl(
      'postgresql://test:test@localhost:5432/nexus_disposable_test?schema=public',
    ).pathname).toBe('/nexus_disposable_test');
  });

  it('still refuses generic and production-like database identities', () => {
    process.env.NEXUS_DISPOSABLE_POSTGRES = '1';

    expect(() => assertDisposablePostgresUrl(
      'postgresql://test:test@localhost:5432/nexus_test?schema=public',
    )).toThrow();
    expect(() => assertDisposablePostgresUrl(
      'postgresql://test:test@localhost:5432/nexus_prod?schema=public',
    )).toThrow();
  });
});
