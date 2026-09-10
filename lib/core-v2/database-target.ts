/**
 * PostgreSQL *target* comparison — the first of two independent, complementary
 * safety layers guarding against Core v2 tooling ever touching the Core v1
 * (legacy) database (foundation hardening, DATABASE_COLLISION_GUARD_WEAKNESS).
 *
 * A raw string/credential comparison is not enough: the same physical
 * PostgreSQL database can be addressed by many different connection strings
 * (different roles, postgres:// vs postgresql://, an explicit vs default
 * port, harmless extra query params, percent-encoding). This module
 * normalizes a connection string down to the four things that actually
 * identify *where a query lands* — scheme, host, effective port, decoded
 * database name — and ignores everything that doesn't: username, password,
 * query-param order, non-identity connection options.
 *
 * This cannot see network-level aliasing (two different hostnames that
 * resolve to the same server, or a load balancer in front of one database).
 * That gap is covered by the second, independent layer: the Core v2 database
 * identity marker validated after connecting (see client.ts). Neither layer
 * replaces the other.
 */

export class CoreV2DatabaseUrlError extends Error {}

const DEFAULT_POSTGRES_PORT = '5432';

interface PostgresTarget {
  readonly host: string;
  readonly port: string;
  readonly database: string;
}

/**
 * Parses a PostgreSQL connection string into its identity-relevant target.
 * Returns null (never throws) for anything that cannot be interpreted
 * reliably — callers in this module always treat that as fail-closed.
 */
function parsePostgresTarget(rawUrl: string): PostgresTarget | null {
  let parsed: URL;
  try {
    // `postgresql:`/`postgres:` are non-special schemes to the WHATWG URL
    // parser, so it neither lowercases the host nor treats consecutive
    // hosts specially — a comma-separated multi-host string
    // (postgresql://h1,h2/db) fails to parse as a URL at all (the comma is
    // not valid in an unbracketed hostname), which the `catch` below turns
    // into a fail-closed reject, same as the explicit comma check further
    // down catches any host value that DOES parse but still contains one.
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const protocol = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (protocol !== 'postgres' && protocol !== 'postgresql') {
    return null;
  }

  // Prisma/libpq support overriding the actual connection host via a
  // `?host=`/`?hostaddr=` query parameter — notably for Unix-domain-socket
  // connections, e.g. `postgresql://<user>:<password>@localhost/db?host=/var/run/postgresql/`.
  // When present, the authority component's hostname is NOT what the
  // database driver actually connects to, so comparing it would be
  // comparing the wrong thing entirely (two different decoy authority
  // hosts could share the same real override target, or vice versa).
  // Reliably canonicalizing libpq's exact override semantics is not
  // something this module can safely guess at — fail closed instead of
  // silently comparing the misleading authority host (Review A, P2-1).
  // Checked case-insensitively: whether Prisma's own parser treats a
  // `?Host=`/`?HOST=` variant as the same override is not something this
  // module can assume either way, so treat any case variant as the
  // override too — this can only make the guard stricter, never looser.
  const hasHostOverride = [...parsed.searchParams.keys()].some(
    (key) => key.toLowerCase() === 'host' || key.toLowerCase() === 'hostaddr',
  );
  if (hasHostOverride) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host === '') {
    return null;
  }
  // A well-formed single host/IPv6-literal never contains a comma; a
  // multi-host connection string (postgresql://h1,h2/db) is ambiguous about
  // which server the identity applies to — fail closed rather than compare
  // against only the first host.
  if (host.includes(',')) {
    return null;
  }

  const port = parsed.port === '' ? DEFAULT_POSTGRES_PORT : parsed.port;

  const encodedDatabase = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (encodedDatabase === '') {
    return null;
  }
  let database: string;
  try {
    database = decodeURIComponent(encodedDatabase);
  } catch {
    return null;
  }

  return { host, port, database };
}

function targetsCollide(a: PostgresTarget, b: PostgresTarget): boolean {
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

/**
 * Fails closed (throws CoreV2DatabaseUrlError) whenever it cannot positively
 * prove that `coreV2Url` and `coreV1Url` address different PostgreSQL
 * targets. Never attempts a connection.
 *
 * - coreV2Url missing/empty/unparseable => REJECT (Core v2 must always have
 *   an explicit, interpretable target).
 * - coreV1Url absent (Core v1 not configured in this environment) => ACCEPT.
 * - coreV1Url present but unparseable => REJECT: an unparseable Core v1 URL
 *   means non-collision cannot be proven, and a sensitive guard must not
 *   pass on "cannot tell".
 * - Both parse => REJECT iff they resolve to the same host+port+database.
 */
export function assertNoCoreV1V2TargetCollision(
  coreV2Url: string | undefined,
  coreV1Url: string | undefined,
): void {
  if (!coreV2Url || coreV2Url.trim() === '') {
    throw new CoreV2DatabaseUrlError(
      'CORE_V2_DATABASE_URL is required for any Core v2 database access and was not set. ' +
        'Core v2 code must never fall back to DATABASE_URL — set CORE_V2_DATABASE_URL explicitly.',
    );
  }

  const coreV2Target = parsePostgresTarget(coreV2Url);
  if (!coreV2Target) {
    throw new CoreV2DatabaseUrlError(
      'CORE_V2_DATABASE_URL could not be interpreted as a single, unambiguous PostgreSQL target. ' +
        'Refusing to connect: a sensitive database-identity check must fail closed rather than guess.',
    );
  }

  if (coreV1Url === undefined || coreV1Url.trim() === '') {
    return;
  }

  const coreV1Target = parsePostgresTarget(coreV1Url);
  if (!coreV1Target) {
    throw new CoreV2DatabaseUrlError(
      'DATABASE_URL is set but could not be interpreted as a single, unambiguous PostgreSQL target, ' +
        'so non-collision with CORE_V2_DATABASE_URL cannot be proven. Refusing to connect (fail closed).',
    );
  }

  if (targetsCollide(coreV2Target, coreV1Target)) {
    throw new CoreV2DatabaseUrlError(
      'CORE_V2_DATABASE_URL and DATABASE_URL resolve to the same PostgreSQL target ' +
        '(same host, port, and database — credentials and query parameters are not identity). ' +
        'Refusing to connect: this would point Core v2 tooling at the Core v1 (legacy) database, ' +
        'which is exactly the collision this guard exists to prevent. Point CORE_V2_DATABASE_URL ' +
        'at a distinct Core v2 database.',
    );
  }
}
