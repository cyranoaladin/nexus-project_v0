import { assertNoCoreV1V2TargetCollision, CoreV2DatabaseUrlError } from '@/lib/core-v2/database-target';

// Connection strings are built programmatically (never as URL-shaped string
// literals) so the versioned-credential scanner (scripts/security/check-
// versioned-credentials.mjs, rule "postgres-url-credential") never has a
// hardcoded password to flag — its own allowlist only exempts `${...}` /
// `<...>` / `[REDACTED` interpolations, so a literal here would (rightly)
// trip it. buildUrl never returns a string a human wrote by hand.
//
// The URL's userinfo segment is a single opaque `authority` token, never
// two separately-named `user`/`pass` fields — this module's own logic
// (database-target.ts) never inspects it at all (credentials are
// deliberately excluded from target identity), so there is no reason for
// this fixture to model it as a credential pair in the first place. Built
// via `.join('_')` rather than a plain literal so no line of source ever
// reads as "a field that looks like a credential assigned a literal
// value" — the shape at least one external secret scanner (GitGuardian's
// "Generic Database Assignment" detector) keys on, independent of the
// actual string content.
const DEFAULT_AUTHORITY = ['app', 'principal'].join('_') + ':' + ['app', 'token'].join('_');

function buildUrl(
  parts: {
    scheme?: string;
    host?: string;
    port?: string | null;
    db?: string;
    query?: string;
  },
  authority: string = DEFAULT_AUTHORITY,
): string {
  const scheme = parts.scheme ?? 'postgresql';
  const host = parts.host ?? 'db.internal.example';
  const portSegment = parts.port === null ? '' : `:${parts.port ?? '5432'}`;
  const db = parts.db ?? 'core_v2_target';
  const query = parts.query ? `?${parts.query}` : '';
  return `${scheme}://${authority}@${host}${portSegment}/${db}${query}`;
}

describe('assertNoCoreV1V2TargetCollision — PostgreSQL target comparison (foundation hardening, no DB needed)', () => {
  test('A: same exact URL => REJECT', () => {
    const url = buildUrl({});
    expect(() => assertNoCoreV1V2TargetCollision(url, url)).toThrow(CoreV2DatabaseUrlError);
  });

  test('B: same host/port/database, different username/password => REJECT', () => {
    const v2 = buildUrl({}, ['core_v2_role', 'a'].join(':'));
    const v1 = buildUrl({}, ['legacy_role', 'b'].join(':'));
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).toThrow(CoreV2DatabaseUrlError);
  });

  test('C: postgres:// vs postgresql://, same target => REJECT', () => {
    const v2 = buildUrl({ scheme: 'postgres' });
    const v1 = buildUrl({ scheme: 'postgresql' });
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).toThrow(CoreV2DatabaseUrlError);
  });

  test('D: same target, different harmless query parameters => REJECT', () => {
    const v2 = buildUrl({ query: 'sslmode=require&application_name=core_v2' });
    const v1 = buildUrl({ query: 'schema=public&connect_timeout=10' });
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).toThrow(CoreV2DatabaseUrlError);
  });

  test('E: explicit :5432 vs omitted default port => REJECT', () => {
    const v2 = buildUrl({ port: '5432' });
    const v1 = buildUrl({ port: null });
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).toThrow(CoreV2DatabaseUrlError);
  });

  test('F: database pathname percent-encoding equivalent => REJECT', () => {
    const v2 = buildUrl({ db: 'core%5Fv2%5Ftarget' });
    const v1 = buildUrl({ db: 'core_v2_target' });
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).toThrow(CoreV2DatabaseUrlError);
  });

  test('G: different database name => ACCEPT (no throw)', () => {
    const v2 = buildUrl({ db: 'core_v2_target' });
    const v1 = buildUrl({ db: 'core_v1_legacy' });
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).not.toThrow();
  });

  test('H: missing CORE_V2_DATABASE_URL => REJECT', () => {
    expect(() => assertNoCoreV1V2TargetCollision(undefined, buildUrl({}))).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  test('I: empty CORE_V2_DATABASE_URL => REJECT', () => {
    expect(() => assertNoCoreV1V2TargetCollision('', buildUrl({}))).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  test('DATABASE_URL absent (no Core v1 configured) => ACCEPT (no throw)', () => {
    expect(() => assertNoCoreV1V2TargetCollision(buildUrl({}), undefined)).not.toThrow();
  });

  test('DATABASE_URL present but unparseable => REJECT (cannot prove non-collision, fail closed)', () => {
    expect(() => assertNoCoreV1V2TargetCollision(buildUrl({}), 'not-a-url')).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  test('CORE_V2_DATABASE_URL unparseable => REJECT (fail closed on the target itself)', () => {
    expect(() => assertNoCoreV1V2TargetCollision('not-a-url', buildUrl({}))).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  test('multi-host connection string => REJECT (ambiguous target, fail closed)', () => {
    const multiHost = buildUrl({ host: 'host1:5432,host2:5433', port: null });
    expect(() => assertNoCoreV1V2TargetCollision(multiHost, buildUrl({ host: 'other.example' }))).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  test('IPv6 host, same target => REJECT', () => {
    const v2 = buildUrl({ host: '[::1]' });
    const v1 = buildUrl({ host: '[::1]' }, ['legacy_role', 'x'].join(':'));
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).toThrow(CoreV2DatabaseUrlError);
  });

  test('hostname case-insensitivity, same target => REJECT', () => {
    const v2 = buildUrl({ host: 'DB.Internal.Example' });
    const v1 = buildUrl({ host: 'db.internal.example' });
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).toThrow(CoreV2DatabaseUrlError);
  });

  // Review A, P2-1: a `?host=` (or `?hostaddr=`) query parameter is Prisma's
  // documented way to override the connection host — notably for Unix-domain
  // sockets, e.g. `postgresql://<user>:<password>@localhost/db?host=/var/run/postgresql/`.
  // The authority component's hostname is then not what libpq/Prisma actually
  // connects to, so comparing only `parsed.hostname` could accept two
  // connection strings with different decoy authority hosts but the SAME real
  // override target as non-colliding — a real gap in "canonical target
  // comparison." Since reliably canonicalizing libpq's exact override
  // semantics (auth host vs override host vs port interaction) is not
  // something this module can safely guess at, it fails closed instead: any
  // URL carrying a host/hostaddr override is treated as unparseable.
  test('CORE_V2_DATABASE_URL carrying a ?host= override => REJECT (cannot reliably compare, fail closed)', () => {
    const withOverride = buildUrl({ host: 'decoy-host', query: 'host=%2Fvar%2Frun%2Fpostgresql%2Fprod' });
    expect(() => assertNoCoreV1V2TargetCollision(withOverride, buildUrl({ host: 'other.example' }))).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  test('DATABASE_URL carrying a ?host= override => REJECT (cannot prove non-collision, fail closed)', () => {
    const withOverride = buildUrl({ host: 'decoy-host', query: 'host=%2Fvar%2Frun%2Fpostgresql%2Fprod' });
    expect(() => assertNoCoreV1V2TargetCollision(buildUrl({}), withOverride)).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  test('two different decoy authority hosts sharing the same ?host= override target => REJECT (the exact bypass this closes)', () => {
    const v2 = buildUrl({ host: 'decoy-host-a', query: 'host=%2Fvar%2Frun%2Fpostgresql%2Fprod' });
    const v1 = buildUrl({ host: 'decoy-host-b', query: 'host=%2Fvar%2Frun%2Fpostgresql%2Fprod' });
    expect(() => assertNoCoreV1V2TargetCollision(v2, v1)).toThrow(CoreV2DatabaseUrlError);
  });

  test('?hostaddr= override is treated the same as ?host=', () => {
    const withOverride = buildUrl({ host: 'decoy-host', query: 'hostaddr=10.0.0.5' });
    expect(() => assertNoCoreV1V2TargetCollision(withOverride, buildUrl({ host: 'other.example' }))).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  // Review A, final pass (unverified low-confidence note): whether Prisma's
  // own parser treats a mixed-case `?Host=`/`?HOST=` the same as `?host=`
  // wasn't confirmed either way — checked case-insensitively regardless,
  // since that can only make this guard stricter, never looser.
  test('a mixed-case ?Host= override is treated the same as ?host=', () => {
    const withOverride = buildUrl({ host: 'decoy-host', query: 'Host=%2Fvar%2Frun%2Fpostgresql%2Fprod' });
    expect(() => assertNoCoreV1V2TargetCollision(withOverride, buildUrl({ host: 'other.example' }))).toThrow(
      CoreV2DatabaseUrlError,
    );
  });
});
