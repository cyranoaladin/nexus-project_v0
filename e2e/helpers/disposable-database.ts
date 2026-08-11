const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', 'postgres-e2e']);
const ALLOWED_DATABASE = 'nexus_e2e';

/** Fail closed before an E2E spec can mutate a database. */
export function assertDisposableE2eDatabase(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('E2E_DATABASE_URL_INVALID');
  }
  const database = parsed.pathname.replace(/^\//, '');
  if (
    process.env.E2E_DISPOSABLE_STACK !== '1'
    ||
    parsed.protocol !== 'postgresql:'
    || !ALLOWED_HOSTS.has(parsed.hostname)
    || database !== ALLOWED_DATABASE
    || /(?:prod|production)/i.test(parsed.hostname)
    || /(?:prod|production)/i.test(database)
  ) {
    throw new Error('E2E_DATABASE_NOT_DISPOSABLE');
  }
  return parsed;
}
