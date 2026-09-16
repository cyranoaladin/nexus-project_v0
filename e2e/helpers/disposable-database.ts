const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', 'postgres-e2e']);
const ALLOWED_DATABASE = 'nexus_e2e';

export type DisposableE2eCheck =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly reason: string };

/**
 * The E2E disposable contract, as a check rather than an assertion, so callers
 * that can be reached from more than one harness can ask instead of guessing.
 * The rules are unchanged: an explicit E2E_DISPOSABLE_STACK marker, the
 * postgresql protocol, a known-local host, and exactly the nexus_e2e database.
 */
export function checkDisposableE2eDatabase(value: string): DisposableE2eCheck {
  if (process.env.E2E_DISPOSABLE_STACK !== '1') {
    return { ok: false, reason: 'MISSING_E2E_DISPOSABLE_STACK' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'E2E_DATABASE_URL_INVALID' };
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (parsed.protocol !== 'postgresql:') {
    return { ok: false, reason: `UNEXPECTED_PROTOCOL:${parsed.protocol}` };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { ok: false, reason: `NON_LOCAL_HOST:${parsed.hostname}` };
  }
  if (/(?:prod|production)/i.test(parsed.hostname)) {
    return { ok: false, reason: `PRODUCTION_HOST_PATTERN:${parsed.hostname}` };
  }
  if (/(?:prod|production)/i.test(database)) {
    return { ok: false, reason: `PRODUCTION_DATABASE_PATTERN:${database}` };
  }
  if (database !== ALLOWED_DATABASE) {
    return { ok: false, reason: `NON_DISPOSABLE_DATABASE_NAME:${database}` };
  }

  return { ok: true, url: parsed };
}

/** Fail closed before an E2E spec can mutate a database. */
export function assertDisposableE2eDatabase(value: string): URL {
  const result = checkDisposableE2eDatabase(value);
  if (!result.ok) {
    throw new Error(
      result.reason === 'E2E_DATABASE_URL_INVALID'
        ? 'E2E_DATABASE_URL_INVALID'
        : 'E2E_DATABASE_NOT_DISPOSABLE',
    );
  }
  return result.url;
}
