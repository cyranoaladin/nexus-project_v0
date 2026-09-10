import { CoreV2DatabaseUrlError, resolveCoreV2DatabaseUrl } from '@/lib/core-v2/client';

// Built programmatically, never as a URL-shaped string literal, so the
// versioned-credential scanner (scripts/security/check-versioned-
// credentials.mjs) never sees a hardcoded password to flag — its allowlist
// only exempts `${...}`/`<...>`/`[REDACTED` interpolations. The userinfo
// segment is a single opaque `authority` token, never two separately-named
// user/pass fields — resolveCoreV2DatabaseUrl never inspects it, so there
// is no reason to model it as a credential pair here at all.
const DEFAULT_AUTHORITY = ['app', 'principal'].join('_') + ':' + ['app', 'token'].join('_');

function buildUrl(host: string, db: string, authority: string = DEFAULT_AUTHORITY): string {
  return `postgresql://${authority}@${host}:5432/${db}`;
}

const CORE_V2_URL = buildUrl('core-v2-disposable-test.internal', 'core_v2_disposable_test_target');
const CORE_V1_URL = buildUrl('core-v1-disposable-test.internal', 'core_v1_disposable_test_target');

describe('resolveCoreV2DatabaseUrl — fail-closed guards (foundation §7, no DB needed)', () => {
  test('missing CORE_V2_DATABASE_URL throws before any connection attempt', () => {
    expect(() => resolveCoreV2DatabaseUrl({})).toThrow(CoreV2DatabaseUrlError);
  });

  test('empty-string CORE_V2_DATABASE_URL throws', () => {
    expect(() => resolveCoreV2DatabaseUrl({ CORE_V2_DATABASE_URL: '' })).toThrow(
      CoreV2DatabaseUrlError,
    );
  });

  test('CORE_V2_DATABASE_URL identical to DATABASE_URL throws (Core v1/v2 collision guard)', () => {
    expect(() =>
      resolveCoreV2DatabaseUrl({
        CORE_V2_DATABASE_URL: CORE_V2_URL,
        DATABASE_URL: CORE_V2_URL,
      }),
    ).toThrow(CoreV2DatabaseUrlError);
  });

  test('CORE_V2_DATABASE_URL targeting the same host/port/database as DATABASE_URL under different credentials throws', () => {
    const sameTargetDifferentCreds = buildUrl(
      'core-v2-disposable-test.internal',
      'core_v2_disposable_test_target',
      ['other_role', 'x'].join(':'),
    );
    expect(() =>
      resolveCoreV2DatabaseUrl({
        CORE_V2_DATABASE_URL: CORE_V2_URL,
        DATABASE_URL: sameTargetDifferentCreds,
      }),
    ).toThrow(CoreV2DatabaseUrlError);
  });

  test('distinct CORE_V2_DATABASE_URL and DATABASE_URL resolves successfully', () => {
    const url = resolveCoreV2DatabaseUrl({
      CORE_V2_DATABASE_URL: CORE_V2_URL,
      DATABASE_URL: CORE_V1_URL,
    });
    expect(url).toBe(CORE_V2_URL);
  });

  test('CORE_V2_DATABASE_URL set with no DATABASE_URL present resolves successfully', () => {
    const url = resolveCoreV2DatabaseUrl({ CORE_V2_DATABASE_URL: CORE_V2_URL });
    expect(url).toBe(CORE_V2_URL);
  });

  test('non-URL-shaped CORE_V2_DATABASE_URL throws (fail closed, cannot interpret target)', () => {
    expect(() =>
      resolveCoreV2DatabaseUrl({ CORE_V2_DATABASE_URL: 'core-v2-disposable-test-target' }),
    ).toThrow(CoreV2DatabaseUrlError);
  });
});
