import { CoreV2DatabaseUrlError, resolveCoreV2DatabaseUrl } from '@/lib/core-v2/client';

// Deliberately not shaped like a real connection string (no `scheme://user:pass@host`)
// — resolveCoreV2DatabaseUrl only compares/returns these values, never parses them,
// and a URL-shaped literal here would (rightly) trip the versioned-credential scanner.
const CORE_V2_PLACEHOLDER = 'core-v2-disposable-test-target';
const CORE_V1_PLACEHOLDER = 'core-v1-disposable-test-target';

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
        CORE_V2_DATABASE_URL: CORE_V2_PLACEHOLDER,
        DATABASE_URL: CORE_V2_PLACEHOLDER,
      }),
    ).toThrow(CoreV2DatabaseUrlError);
  });

  test('distinct CORE_V2_DATABASE_URL and DATABASE_URL resolves successfully', () => {
    const url = resolveCoreV2DatabaseUrl({
      CORE_V2_DATABASE_URL: CORE_V2_PLACEHOLDER,
      DATABASE_URL: CORE_V1_PLACEHOLDER,
    });
    expect(url).toBe(CORE_V2_PLACEHOLDER);
  });

  test('CORE_V2_DATABASE_URL set with no DATABASE_URL present resolves successfully', () => {
    const url = resolveCoreV2DatabaseUrl({ CORE_V2_DATABASE_URL: CORE_V2_PLACEHOLDER });
    expect(url).toBe(CORE_V2_PLACEHOLDER);
  });
});
