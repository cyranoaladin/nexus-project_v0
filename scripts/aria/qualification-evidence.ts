import { relative } from 'node:path';

export type AriaQualificationLane =
  | 'unit'
  | 'api'
  | 'integration'
  | 'database'
  | 'concurrency'
  | 'architecture'
  | 'e2e'
  | 'smoke';

export interface AriaQualificationCase {
  readonly id: string;
  readonly lane: AriaQualificationLane;
  readonly status: 'PASSED' | 'FAILED';
  readonly title: string;
  readonly path: string;
}

export interface AriaQualificationEvidence {
  readonly schemaVersion: 1;
  readonly headSha: string;
  readonly cases: readonly AriaQualificationCase[];
}

interface JestAssertionResult {
  readonly fullName?: unknown;
  readonly title?: unknown;
  readonly status?: unknown;
}

interface JestTestResult {
  readonly name?: unknown;
  readonly assertionResults?: unknown;
  readonly testResults?: unknown;
}

interface JestJsonResult {
  readonly testResults?: unknown;
}

interface PlaywrightJsonSuite {
  readonly title?: unknown;
  readonly file?: unknown;
  readonly specs?: unknown;
  readonly suites?: unknown;
}

interface PlaywrightJsonResult {
  readonly suites?: unknown;
}

const REGISTRY = Object.freeze([
  ['U', 64],
  ['A', 20],
  ['I', 24],
  ['D', 20],
  ['H', 12],
  ['E', 26],
  ['P', 19],
  ['S', 10],
] as const);

function numberedIds(prefix: string, count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) =>
    `${prefix}${String(index + 1).padStart(3, '0')}`);
}

export function expectedAriaQualificationIds(): readonly string[] {
  return Object.freeze([
    ...REGISTRY.flatMap(([prefix, count]) => numberedIds(prefix, count)),
    ...numberedIds('ARIA-B-R', 99),
  ]);
}

function normalizedReferencePrefix(prefix: string): string {
  return prefix.endsWith('R') ? 'ARIA-B-R' : prefix;
}

export function qualificationIdsInReference(reference: string): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const malformed = reference.match(
    /(?<![\p{L}\p{N}\p{M}_])(?:(?:ARIA-B-)?R|[UAIDHESP])\d{4,}(?!\d)/u,
  );
  if (malformed) fail(`MALFORMED_ID:${malformed[0]}`);
  const rangeLexemes = reference.matchAll(
    /(?<![\p{L}\p{N}\p{M}_\p{Dash_Punctuation}])((?:(?:ARIA-B-)?R|[UAIDHESP])\d+[\p{L}\p{M}]*)\s*\p{Dash_Punctuation}\s*((?:(?:ARIA-B-)?R|[UAIDHESP])?\d+[\p{L}\p{M}]*)(?![\p{L}\p{N}\p{M}_])/gu,
  );
  for (const range of rangeLexemes) {
    const validStart = /^(?:(?:ARIA-B-)?R|[UAIDHESP])\d{3}$/u.test(range[1]!);
    const validEnd = /^(?:(?:ARIA-B-)?R|[UAIDHESP])?\d{3}$/u.test(range[2]!);
    if (!validStart || !validEnd) fail(`MALFORMED_RANGE:${range[1]}-${range[2]}`);
  }
  const rangeStarts = reference.matchAll(
    /(?<![\p{L}\p{N}\p{M}_\p{Dash_Punctuation}])((?:ARIA-B-)?R|[UAIDHESP])(\d{3})\s*\p{Dash_Punctuation}\s*/gu,
  );
  for (const rangeStart of rangeStarts) {
    const remainder = reference.slice((rangeStart.index ?? 0) + rangeStart[0].length);
    if (!/^(?:(?:ARIA-B-)?R|[UAIDHESP])?\d{3}(?![\p{L}\p{N}\p{M}_\p{Dash_Punctuation}])/u.test(remainder)) {
      const endpoint = remainder.match(/^[^\s/,;|)]+/u)?.[0] ?? 'MISSING';
      fail(`MALFORMED_RANGE:${rangeStart[1]}${rangeStart[2]}-${endpoint}`);
    }
  }
  const pattern = /(?<![\p{L}\p{N}\p{M}_\p{Dash_Punctuation}])((?:ARIA-B-)?R|[UAIDHESP])(\d{3})(?:\s*\p{Dash_Punctuation}\s*((?:ARIA-B-)?R|[UAIDHESP])?(\d{3}))?(?![\p{L}\p{N}\p{M}_\p{Dash_Punctuation}])/gu;
  for (const match of reference.matchAll(pattern)) {
    const prefix = normalizedReferencePrefix(match[1]!);
    const start = Number(match[2]);
    const endPrefix = match[3] ? normalizedReferencePrefix(match[3]) : prefix;
    const end = match[4] ? Number(match[4]) : start;
    if (endPrefix !== prefix) fail(`RANGE_PREFIX:${prefix}:${endPrefix}`);
    if (end < start) fail(`RANGE_ORDER:${prefix}${match[2]}:${match[4]}`);
    for (let value = start; value <= end; value += 1) {
      const id = `${prefix}${String(value).padStart(3, '0')}`;
      if (!seen.has(id)) {
        ids.push(id);
        seen.add(id);
      }
    }
  }
  return Object.freeze(ids);
}

function idsInTitle(title: string): readonly string[] {
  const candidates = [...title.matchAll(
    /(?<![\p{L}\p{N}\p{M}_])(?:ARIA-B-R|[UAIDHESP])\d{3}(?![\p{L}\p{N}\p{M}_])/gu,
  )].map((match) => match[0]);
  return [...new Set(candidates)];
}

function assertionsOf(result: JestTestResult): readonly JestAssertionResult[] {
  const assertions = Array.isArray(result.assertionResults)
    ? result.assertionResults
    : Array.isArray(result.testResults)
      ? result.testResults
      : [];
  return assertions.filter((item): item is JestAssertionResult =>
    typeof item === 'object' && item !== null);
}

export function extractQualificationCasesFromJest(
  lane: Exclude<AriaQualificationLane, 'e2e' | 'smoke'>,
  document: JestJsonResult,
): readonly AriaQualificationCase[] {
  const testResults = Array.isArray(document.testResults)
    ? document.testResults.filter((item): item is JestTestResult =>
      typeof item === 'object' && item !== null)
    : [];
  const aggregates = new Map<string, AriaQualificationCase>();
  for (const testResult of testResults) {
    const path = typeof testResult.name === 'string'
      ? relative(process.cwd(), testResult.name)
      : 'UNKNOWN_TEST_PATH';
    for (const assertion of assertionsOf(testResult)) {
      const title = typeof assertion.fullName === 'string'
        ? assertion.fullName
        : typeof assertion.title === 'string'
          ? assertion.title
          : '';
      const status = assertion.status === 'passed' ? 'PASSED' as const : 'FAILED' as const;
      for (const id of idsInTitle(title)) {
        if (!laneAccepts(id, lane)) continue;
        const item = { id, lane, status, title, path } as const;
        const previous = aggregates.get(id);
        if (!previous || (previous.status === 'PASSED' && item.status === 'FAILED')) {
          aggregates.set(id, item);
        }
      }
    }
  }
  return Object.freeze([...aggregates.values()]
    .sort((left, right) => left.id.localeCompare(right.id)));
}

export function extractQualificationCasesFromPlaywright(
  document: PlaywrightJsonResult,
  lane: Extract<AriaQualificationLane, 'e2e' | 'smoke'> = 'e2e',
): readonly AriaQualificationCase[] {
  const cases: AriaQualificationCase[] = [];
  const visit = (suite: PlaywrightJsonSuite, inheritedPath = 'UNKNOWN_E2E_PATH'): void => {
    const path = typeof suite.file === 'string' ? suite.file : inheritedPath;
    const specs = Array.isArray(suite.specs) ? suite.specs : [];
    for (const value of specs) {
      if (typeof value !== 'object' || value === null) continue;
      const spec = value as { readonly title?: unknown; readonly tests?: unknown };
      const title = typeof spec.title === 'string' ? spec.title : '';
      const tests = Array.isArray(spec.tests) ? spec.tests : [];
      const results = tests.flatMap((test) => {
        if (typeof test !== 'object' || test === null) return [];
        const candidate = (test as { readonly results?: unknown }).results;
        return Array.isArray(candidate) ? candidate : [];
      });
      const passed = results.length > 0 && results.every((result) =>
        typeof result === 'object' && result !== null
        && (result as { readonly status?: unknown }).status === 'passed');
      const prefix = lane === 'smoke' ? 'S' : 'E';
      for (const id of idsInTitle(title).filter((candidate) => candidate.startsWith(prefix))) {
        cases.push({
          id,
          lane,
          status: passed ? 'PASSED' : 'FAILED',
          title,
          path,
        });
      }
    }
    const children = Array.isArray(suite.suites) ? suite.suites : [];
    for (const child of children) {
      if (typeof child === 'object' && child !== null) {
        visit(child as PlaywrightJsonSuite, path);
      }
    }
  };
  const suites = Array.isArray(document.suites) ? document.suites : [];
  for (const suite of suites) {
    if (typeof suite === 'object' && suite !== null) visit(suite as PlaywrightJsonSuite);
  }
  return Object.freeze(cases.sort((left, right) => left.id.localeCompare(right.id)));
}

function fail(reason: string): never {
  throw new Error(`ARIA_TEST_TRACEABILITY_INVALID:${reason}`);
}

function laneAccepts(id: string, lane: AriaQualificationLane): boolean {
  if (id.startsWith('ARIA-B-R')) return lane !== 'smoke';
  if (id.startsWith('U') || id.startsWith('P')) return lane === 'unit';
  if (id.startsWith('A')) return lane === 'api';
  if (id.startsWith('I')) return lane === 'integration';
  if (id.startsWith('D')) return lane === 'database' || lane === 'concurrency';
  if (id.startsWith('H')) return lane === 'architecture';
  if (id.startsWith('E')) return lane === 'e2e';
  if (id.startsWith('S')) return lane === 'smoke';
  return false;
}

export function validateAriaQualificationEvidence(
  evidence: AriaQualificationEvidence,
  expectedHeadSha: string,
): Readonly<{
  headSha: string;
  passed: number;
  missing: readonly string[];
  duplicate: readonly string[];
  failed: readonly string[];
  unknown: readonly string[];
}> {
  if (evidence.schemaVersion !== 1) fail('SCHEMA_VERSION');
  if (evidence.headSha !== expectedHeadSha) fail('STALE_HEAD');
  const expected = expectedAriaQualificationIds();
  const expectedSet = new Set(expected);
  const byId = new Map<string, AriaQualificationCase[]>();
  for (const item of evidence.cases) {
    const values = byId.get(item.id) ?? [];
    values.push(item);
    byId.set(item.id, values);
  }
  const missing = expected.filter((id) => !byId.has(id));
  const duplicate = expected.filter((id) => (byId.get(id)?.length ?? 0) > 1);
  const failed = expected.filter((id) => byId.get(id)?.some((item) => item.status !== 'PASSED'));
  const unknown = [...byId.keys()].filter((id) => !expectedSet.has(id)).sort();
  if (missing.length > 0) fail(`MISSING:${missing.join(',')}`);
  if (duplicate.length > 0) fail(`DUPLICATE:${duplicate.join(',')}`);
  if (failed.length > 0) fail(`FAILED:${failed.join(',')}`);
  if (unknown.length > 0) fail(`UNKNOWN:${unknown.join(',')}`);
  const invalidLane = expected.find((id) =>
    byId.get(id)?.some((item) => !laneAccepts(id, item.lane)));
  if (invalidLane) fail(`LANE:${invalidLane}`);
  return Object.freeze({
    headSha: evidence.headSha,
    passed: expected.length,
    missing: Object.freeze(missing),
    duplicate: Object.freeze(duplicate),
    failed: Object.freeze(failed),
    unknown: Object.freeze(unknown),
  });
}
