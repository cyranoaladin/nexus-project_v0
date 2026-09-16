/**
 * Shared fail-closed guard for every real-database lane.
 *
 * The rules live in `checkDisposablePostgresUrl` and nowhere else. Both the
 * throwing form and any caller that wants to inspect the reason go through it,
 * so the definition of "disposable" cannot drift between runtimes.
 *
 * It deliberately carries no test-runner dependency. It is called from jest
 * suites, from Playwright specs and from the canonical fixture cleanup helper,
 * and an earlier version that asserted through jest's `expect` threw
 * `ReferenceError: expect is not defined` the moment a Playwright spec reached
 * it — a guard that fails to run is a guard that protects nothing.
 */

export type DisposablePostgresCheck =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly reason: string };

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost']);
const DISPOSABLE_DATABASE = /^nexus_disposable_(?:[a-z0-9]+_)*test$/;
const PRODUCTION_PATTERN = /(?:prod|production)/i;

/** The rules, in one place, with no test-runner dependency. */
export function checkDisposablePostgresUrl(value: string): DisposablePostgresCheck {
  // A positive marker, set by the disposable harness itself — never inferred
  // from NODE_ENV, which any process can claim.
  if (process.env.NEXUS_DISPOSABLE_POSTGRES !== '1') {
    return { ok: false, reason: 'MISSING_DISPOSABLE_MARKER' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'INVALID_DATABASE_URL' };
  }

  if (parsed.protocol !== 'postgresql:') {
    return { ok: false, reason: `UNEXPECTED_PROTOCOL:${parsed.protocol}` };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { ok: false, reason: `NON_LOCAL_HOST:${parsed.hostname}` };
  }
  if (PRODUCTION_PATTERN.test(parsed.hostname)) {
    return { ok: false, reason: `PRODUCTION_HOST_PATTERN:${parsed.hostname}` };
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (PRODUCTION_PATTERN.test(database)) {
    return { ok: false, reason: `PRODUCTION_DATABASE_PATTERN:${database}` };
  }
  if (!DISPOSABLE_DATABASE.test(database)) {
    return { ok: false, reason: `NON_DISPOSABLE_DATABASE_NAME:${database}` };
  }

  return { ok: true, url: parsed };
}

/**
 * Fail closed on anything that is not provably a disposable test database.
 * Throws a plain Error, so it behaves identically under jest, Playwright and
 * plain node.
 */
export function assertDisposablePostgresUrl(value: string): URL {
  const result = checkDisposablePostgresUrl(value);
  if (!result.ok) {
    throw new Error(`DISPOSABLE_POSTGRES_GUARD_FAILED:${result.reason}`);
  }
  return result.url;
}
