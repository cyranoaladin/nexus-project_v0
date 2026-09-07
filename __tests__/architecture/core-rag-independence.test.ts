/**
 * Task 16 (docs/superpowers/plans/2026-09-06-core-family-academic-planning.md) —
 * architectural proof that CORE's critical paths (Tasks 1-15: family
 * creation, academic map, coach assignments, governed planning, owned
 * dashboards) make ZERO outbound RAG requests and carry no accidental
 * import-time or module-level coupling to RAG infrastructure being
 * configured or reachable.
 *
 * This is NOT a RAG feature test. `lib/rag-client.ts`, `lib/aria/rag.ts` and
 * `lib/aria/infrastructure/rag/manifest.ts` stay untouched — see
 * `CORE_GO_LIVE_GATE.md`'s independent-gates doctrine ("CORE prêt
 * n'implique pas RAG prêt ; RAG prêt n'implique pas CORE prêt"). Every RAG
 * environment variable actually read by that subsystem
 * (`lib/rag-client.ts`'s `getIngestorUrl`/`ragSearch`,
 * `lib/aria/infrastructure/rag/rag-engine-client.ts`'s
 * `loadAriaRagEngineClientConfig`, `lib/aria/infrastructure/rag/manifest.ts`'s
 * `configuredAriaServableManifest`, and
 * `lib/aria/infrastructure/rag/internal-identity.ts`'s
 * `loadAriaRagIdentitySignerConfig`) is cleared before every CORE module is
 * imported, and a `fetch` recorder fails the test the instant any outbound
 * request is attempted.
 *
 * A green run here is the expected characterization, not a regression fix:
 * Tasks 1-15 never imported the RAG subsystem from CORE code. If this ever
 * goes red, it means a CORE boundary picked up a real (accidental) RAG
 * dependency — that is the bug this file exists to catch.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string): string => readFileSync(join(process.cwd(), relativePath), 'utf8');

/**
 * Every environment variable actually read by the RAG subsystem today.
 * Sourced from:
 *   - lib/rag-client.ts (getIngestorUrl, ragSearch)
 *   - lib/aria/infrastructure/rag/rag-engine-client.ts (loadAriaRagEngineClientConfig)
 *   - lib/aria/infrastructure/rag/manifest.ts (configuredAriaServableManifest)
 *   - lib/aria/infrastructure/rag/internal-identity.ts (loadAriaRagIdentitySignerConfig,
 *     exclusively consumed by the RAG identity-signing chain — grep confirms
 *     no other subsystem reads these NEXUS_INTERNAL_TOKEN_ and NEXUS_SSO_
 *     prefixed names).
 */
const RAG_ENV_VARS = [
  'RAG_INGESTOR_URL',
  'RAG_API_TOKEN',
  'RAG_SEARCH_TIMEOUT',
  'RAG_SEARCH_TIMEOUT_MS',
  'ARIA_RAG_ENGINE_BASE_URL',
  'RAG_BFF_SERVICE_TOKEN',
  'ARIA_RAG_ENGINE_TIMEOUT_MS',
  'ARIA_RAG_ENGINE_MAX_RESPONSE_BYTES',
  'ARIA_RAG_SERVABLE_MANIFEST_ROOT',
  'ARIA_RAG_ACTIVE_MANIFEST_SHA256',
  'NEXUS_INTERNAL_TOKEN_SECRET',
  'NEXUS_INTERNAL_TOKEN_ISSUER',
  'NEXUS_INTERNAL_TOKEN_AUDIENCE',
  'NEXUS_SSO_ISSUER',
  'NEXUS_SSO_AUDIENCE',
] as const;

/** The claim this file exists to prove. Any non-zero value is a CORE defect. */
const EXPECTED_RAG_OUTBOUND_REQUESTS = 0;

/**
 * Representative (not exhaustive) module-level entrypoints across the
 * family/academic/assignment/planning/dashboard overhaul (Tasks 4-14). Many
 * already have their own business-logic unit tests; the goal here is
 * architectural — catching an accidental import-time or module-level RAG
 * dependency, not re-testing business logic.
 */
const CORE_MODULE_ENTRYPOINTS = [
  '@/lib/families/create-family',
  '@/lib/curriculum/student-academic-profile',
  '@/lib/assignments/allowed-courses',
  '@/lib/planning/series',
  '@/lib/dashboard/student-payload',
] as const;

describe('CORE critical paths make zero outbound RAG requests', () => {
  const savedEnv: Partial<Record<(typeof RAG_ENV_VARS)[number], string | undefined>> = {};
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: jest.Mock;
  let recordedRequests: string[];

  beforeEach(() => {
    jest.resetModules();

    for (const name of RAG_ENV_VARS) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }

    recordedRequests = [];
    originalFetch = globalThis.fetch;
    fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' || input instanceof URL ? input.toString() : input.url;
      recordedRequests.push(url);
      throw new Error(`RAG independence violated: unexpected outbound request to ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const name of RAG_ENV_VARS) {
      const value = savedEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  test.each(CORE_MODULE_ENTRYPOINTS)(
    'importing %s with every RAG env var absent makes zero outbound RAG requests',
    async (modulePath) => {
      await expect(import(modulePath)).resolves.toBeDefined();

      expect(recordedRequests).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_RAG_OUTBOUND_REQUESTS);
    },
  );

  test('exercising representative pure CORE functions (planning + assignments) makes zero outbound RAG requests', async () => {
    const { coachCapableCourseKeys } = await import('@/lib/assignments/allowed-courses');
    const {
      generateWeeklyOccurrenceDates,
      parseCalendarDate,
      buildOccurrenceKey,
      tunisTodayUtcMidnight,
    } = await import('@/lib/planning/series');

    expect(() => coachCapableCourseKeys(['MATHEMATIQUES'])).not.toThrow();
    const dates = generateWeeklyOccurrenceDates(tunisTodayUtcMidnight(), { intervalWeeks: 1, count: 3 });
    expect(dates).toHaveLength(3);
    expect(buildOccurrenceKey('series-1', 0)).toBe('series-1:0');
    expect(() => parseCalendarDate('2026-09-07')).not.toThrow();

    expect(recordedRequests).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_RAG_OUTBOUND_REQUESTS);
  });

  test('none of the representative CORE module entrypoints statically import the RAG subsystem', () => {
    const coreFiles = [
      'lib/families/create-family.ts',
      'lib/curriculum/student-academic-profile.ts',
      'lib/assignments/allowed-courses.ts',
      'lib/planning/series.ts',
      'lib/dashboard/student-payload.ts',
    ];
    const forbiddenImportPattern = /from ['"]@\/lib\/(rag-client|aria\/rag|aria\/infrastructure\/rag\/[^'"]+)['"]/;

    for (const file of coreFiles) {
      expect(read(file)).not.toMatch(forbiddenImportPattern);
    }
  });
});
