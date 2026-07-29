const LOCAL_TEST_DATABASE = {
  hostname: '127.0.0.1',
  port: '5434',
} as const;

const CI_TEST_DATABASE = {
  hostnames: new Set(['127.0.0.1', 'localhost']),
  port: '5432',
} as const;

export function getDisposablePostgresRootUrl(
  raw: string | undefined,
  harnessName: string,
): URL {
  if (!raw) {
    throw new Error('An explicit disposable TEST_DATABASE_URL is required');
  }

  const url = new URL(raw);
  const usesPostgres = url.protocol === 'postgres:' || url.protocol === 'postgresql:';
  const isLocalHarness =
    url.hostname === LOCAL_TEST_DATABASE.hostname && url.port === LOCAL_TEST_DATABASE.port;
  const isCiHarness =
    process.env.CI === 'true'
    && CI_TEST_DATABASE.hostnames.has(url.hostname)
    && url.port === CI_TEST_DATABASE.port;

  if (
    !usesPostgres
    || url.pathname !== '/nexus_test'
    || (!isLocalHarness && !isCiHarness)
  ) {
    throw new Error(
      `${harnessName} harness requires a disposable PostgreSQL nexus_test database `
      + 'on 127.0.0.1:5434, or on loopback port 5432 with CI=true',
    );
  }

  return url;
}
