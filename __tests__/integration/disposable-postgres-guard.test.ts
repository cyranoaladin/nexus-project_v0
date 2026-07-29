import { getDisposablePostgresRootUrl } from '../helpers/disposable-postgres-guard';

describe('disposable PostgreSQL harness guard', () => {
  const originalCi = process.env.CI;

  afterEach(() => {
    if (originalCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCi;
    }
  });

  it('allows the dedicated local harness', () => {
    delete process.env.CI;

    expect(
      getDisposablePostgresRootUrl(
        'postgresql://nexus_user:nexus_password@127.0.0.1:5434/nexus_test',
        'Test',
      ).pathname,
    ).toBe('/nexus_test');
  });

  it('allows the official CI harness only when CI is explicit', () => {
    process.env.CI = 'true';

    expect(
      getDisposablePostgresRootUrl(
        'postgresql://postgres:postgres@localhost:5432/nexus_test?schema=public',
        'Test',
      ).hostname,
    ).toBe('localhost');
  });

  it('rejects port 5432 outside CI', () => {
    delete process.env.CI;

    expect(() =>
      getDisposablePostgresRootUrl(
        'postgresql://postgres:postgres@localhost:5432/nexus_test',
        'Test',
      ),
    ).toThrow('disposable PostgreSQL');
  });

  it.each([
    'postgresql://postgres:postgres@database.example.com:5432/nexus_test',
    'postgresql://postgres:postgres@localhost:5432/nexus_production',
    'postgresql://postgres:postgres@127.0.0.1:5433/nexus_test',
  ])('rejects an unsafe CI database target: %s', (databaseUrl) => {
    process.env.CI = 'true';

    expect(() => getDisposablePostgresRootUrl(databaseUrl, 'Test')).toThrow(
      'disposable PostgreSQL',
    );
  });

  it('requires an explicit database URL', () => {
    expect(() => getDisposablePostgresRootUrl(undefined, 'Test')).toThrow(
      'explicit disposable TEST_DATABASE_URL',
    );
  });
});
