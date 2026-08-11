/** Shared fail-closed guard for every real-database test lane. */
export function assertDisposablePostgresUrl(value: string): URL {
  expect(process.env.NEXUS_DISPOSABLE_POSTGRES).toBe('1');
  const parsed = new URL(value);
  expect(parsed.protocol).toBe('postgresql:');
  expect(['127.0.0.1', 'localhost']).toContain(parsed.hostname);
  expect(parsed.hostname).not.toMatch(/(?:prod|production)/i);

  const database = parsed.pathname.replace(/^\//, '');
  expect(database).not.toMatch(/(?:prod|production)/i);
  expect(database).toMatch(/^nexus_disposable_(?:[a-z0-9]+_)*test$/);
  return parsed;
}
