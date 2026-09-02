import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

type MetricName = 'lines' | 'functions' | 'branches' | 'statements';
interface Metric { readonly pct: number }
interface CoverageEntry {
  readonly lines: Metric;
  readonly functions: Metric;
  readonly branches: Metric;
  readonly statements: Metric;
}
type CoverageSummary = Record<string, CoverageEntry> & { readonly total: CoverageEntry };

const METRICS: readonly MetricName[] = ['lines', 'functions', 'branches', 'statements'];
const REQUIRED_LANES = ['application', 'database', 'concurrency'] as const;
export const ARIA_CRITICAL_COVERAGE_SOURCES = Object.freeze([
  'lib/aria/access.ts',
  'lib/aria/application/conversation/build-context.ts',
  'lib/aria/application/conversation/reserve-turn.ts',
  'lib/aria/application/conversation/claim-turn.ts',
  'lib/aria/application/conversation/cancel-turn.ts',
  'lib/aria/application/conversation/run-conversation.ts',
  'lib/aria/application/feedback/public.ts',
  'lib/aria/application/public-error.ts',
  'lib/aria/domain/conversation/turn-state.ts',
  'lib/aria/domain/retrieval/policy.ts',
  'lib/aria/kernel/entitlements.ts',
  'lib/aria/transport/sse-parser.ts',
  'lib/aria/transport/sse.ts',
] as const);

function fail(message: string): never {
  throw new Error(`ARIA_COVERAGE_GATE_FAILED:${message}`);
}

type AriaCoverageLane = typeof REQUIRED_LANES[number];
export interface AriaCoverageEvidence {
  readonly schemaVersion: 1;
  readonly headSha: string;
  readonly lanes: readonly AriaCoverageLane[];
  readonly laneArtifacts: Readonly<Partial<Record<AriaCoverageLane, string>>>;
  readonly coverageFinalSha256: string;
  readonly coverageSummarySha256: string;
}

type AriaCoverageArtifactDigests = Readonly<Partial<Record<
AriaCoverageLane | 'coverageFinal' | 'coverageSummary', string
>>>;

export function validateAriaCoverageEvidence(
  value: unknown,
  expectedHeadSha: string,
  actualDigests?: AriaCoverageArtifactDigests,
): AriaCoverageEvidence {
  if (!value || typeof value !== 'object') fail('EVIDENCE_SCHEMA');
  const evidence = value as Partial<AriaCoverageEvidence>;
  if (evidence.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(evidence.headSha ?? '')) {
    fail('EVIDENCE_SCHEMA');
  }
  if (evidence.headSha !== expectedHeadSha) fail('STALE_HEAD');
  if (!Array.isArray(evidence.lanes)
    || evidence.lanes.length !== REQUIRED_LANES.length
    || REQUIRED_LANES.some((lane, index) => evidence.lanes?.[index] !== lane)) {
    fail('LANES');
  }
  if (!evidence.laneArtifacts || REQUIRED_LANES.some(
    (lane) => !/^[0-9a-f]{64}$/.test(evidence.laneArtifacts?.[lane] ?? ''),
  )) fail('LANE_ARTIFACTS');
  if (!/^[0-9a-f]{64}$/.test(evidence.coverageFinalSha256 ?? '')
    || !/^[0-9a-f]{64}$/.test(evidence.coverageSummarySha256 ?? '')) {
    fail('MERGED_ARTIFACTS');
  }
  if (actualDigests) {
    for (const lane of REQUIRED_LANES) {
      if (actualDigests[lane] !== evidence.laneArtifacts[lane]) fail(`ARTIFACT_TAMPERED:${lane}`);
    }
    if (actualDigests.coverageFinal !== evidence.coverageFinalSha256) {
      fail('ARTIFACT_TAMPERED:coverageFinal');
    }
    if (actualDigests.coverageSummary !== evidence.coverageSummarySha256) {
      fail('ARTIFACT_TAMPERED:coverageSummary');
    }
  }
  return evidence as AriaCoverageEvidence;
}

function sha256(path: string, label: string): string {
  if (!existsSync(path)) fail(`ARTIFACT_MISSING:${label}`);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

interface AriaCoverageCheckOptions {
  readonly repositoryRoot?: string;
  readonly headSha?: string;
}

interface AriaCoverageCheckRunnerOptions extends AriaCoverageCheckOptions {
  readonly write?: (value: string) => void;
}

export interface AriaCoverageCheckReport {
  readonly lines: number;
  readonly functions: number;
  readonly branches: number;
  readonly statements: number;
  readonly criticalCoverage: 100;
}

export function checkAriaCoverage(
  options: AriaCoverageCheckOptions = {},
): AriaCoverageCheckReport {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const coverageRoot = resolve(repositoryRoot, '.artifacts/aria/coverage');
  const summaryPath = resolve(coverageRoot, 'coverage-summary.json');
  const evidencePath = resolve(coverageRoot, 'evidence.json');
  if (!existsSync(summaryPath)) fail('SUMMARY_MISSING');
  if (!existsSync(evidencePath)) fail('EVIDENCE_MISSING');
  const headSha = options.headSha ?? execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
  const actualDigests: Record<AriaCoverageLane | 'coverageFinal' | 'coverageSummary', string> = {
    application: sha256(resolve(coverageRoot, 'application/coverage-final.json'), 'application'),
    database: sha256(resolve(coverageRoot, 'database/coverage-final.json'), 'database'),
    concurrency: sha256(resolve(coverageRoot, 'concurrency/coverage-final.json'), 'concurrency'),
    coverageFinal: sha256(resolve(coverageRoot, 'coverage-final.json'), 'coverageFinal'),
    coverageSummary: sha256(summaryPath, 'coverageSummary'),
  };
  validateAriaCoverageEvidence(
    JSON.parse(readFileSync(evidencePath, 'utf8')) as unknown,
    headSha,
    actualDigests,
  );
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as CoverageSummary;
  for (const metric of METRICS) {
    if (summary.total[metric].pct < 95) {
      fail(`GLOBAL_${metric.toUpperCase()}:${summary.total[metric].pct}`);
    }
  }

  const byRelativePath = new Map(
    Object.entries(summary)
      .filter(([path]) => path !== 'total')
      .map(([path, coverage]) => [relative(repositoryRoot, path), coverage]),
  );
  for (const source of ARIA_CRITICAL_COVERAGE_SOURCES) {
    const coverage = byRelativePath.get(source);
    if (!coverage) fail(`CRITICAL_SOURCE_MISSING:${source}`);
    for (const metric of METRICS) {
      if (coverage[metric].pct !== 100) {
        fail(`CRITICAL_${source}:${metric}:${coverage[metric].pct}`);
      }
    }
  }
  return Object.freeze({
    lines: summary.total.lines.pct,
    functions: summary.total.functions.pct,
    branches: summary.total.branches.pct,
    statements: summary.total.statements.pct,
    criticalCoverage: 100,
  });
}

export function runAriaCoverageCheck(
  options: AriaCoverageCheckRunnerOptions = {},
): 0 {
  const report = checkAriaCoverage(options);
  const write = options.write ?? process.stdout.write.bind(process.stdout);
  write(`ARIA_B_COVERAGE_LINES=${report.lines}\n`);
  write(`ARIA_B_COVERAGE_FUNCTIONS=${report.functions}\n`);
  write(`ARIA_B_COVERAGE_BRANCHES=${report.branches}\n`);
  write(`ARIA_B_COVERAGE_STATEMENTS=${report.statements}\n`);
  write(`ARIA_CRITICAL_COVERAGE=${report.criticalCoverage}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = runAriaCoverageCheck();
}
