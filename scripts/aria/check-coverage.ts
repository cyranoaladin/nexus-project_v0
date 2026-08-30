import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';

type MetricName = 'lines' | 'functions' | 'branches' | 'statements';
interface Metric { readonly pct: number }
interface CoverageEntry { readonly lines: Metric; readonly functions: Metric; readonly branches: Metric; readonly statements: Metric }
type CoverageSummary = Record<string, CoverageEntry> & { readonly total: CoverageEntry };

const SUMMARY = resolve(process.cwd(), '.artifacts/aria/coverage/coverage-summary.json');
const EVIDENCE = resolve(process.cwd(), '.artifacts/aria/coverage/evidence.json');
const METRICS: readonly MetricName[] = ['lines', 'functions', 'branches', 'statements'];
const REQUIRED_LANES = ['application', 'database', 'concurrency'] as const;
const CRITICAL_SOURCES = [
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
] as const;

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

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function main(): void {
  if (!existsSync(SUMMARY)) fail('SUMMARY_MISSING');
  if (!existsSync(EVIDENCE)) fail('EVIDENCE_MISSING');
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const actualDigests: Record<AriaCoverageLane | 'coverageFinal' | 'coverageSummary', string> = {
    application: sha256(resolve(process.cwd(), '.artifacts/aria/coverage/application/coverage-final.json')),
    database: sha256(resolve(process.cwd(), '.artifacts/aria/coverage/database/coverage-final.json')),
    concurrency: sha256(resolve(process.cwd(), '.artifacts/aria/coverage/concurrency/coverage-final.json')),
    coverageFinal: sha256(resolve(process.cwd(), '.artifacts/aria/coverage/coverage-final.json')),
    coverageSummary: sha256(SUMMARY),
  };
  validateAriaCoverageEvidence(
    JSON.parse(readFileSync(EVIDENCE, 'utf8')) as unknown,
    headSha,
    actualDigests,
  );
  const summary = JSON.parse(readFileSync(SUMMARY, 'utf8')) as CoverageSummary;
  for (const metric of METRICS) {
    if (summary.total[metric].pct < 95) fail(`GLOBAL_${metric.toUpperCase()}:${summary.total[metric].pct}`);
  }

  const byRelativePath = new Map(
    Object.entries(summary)
      .filter(([path]) => path !== 'total')
      .map(([path, coverage]) => [relative(process.cwd(), path), coverage]),
  );
  for (const source of CRITICAL_SOURCES) {
    const coverage = byRelativePath.get(source);
    if (!coverage) fail(`CRITICAL_SOURCE_MISSING:${source}`);
    for (const metric of METRICS) {
      if (coverage[metric].pct !== 100) fail(`CRITICAL_${source}:${metric}:${coverage[metric].pct}`);
    }
  }

  for (const metric of METRICS) {
    process.stdout.write(`ARIA_B_COVERAGE_${metric.toUpperCase()}=${summary.total[metric].pct}\n`);
  }
  process.stdout.write('ARIA_CRITICAL_COVERAGE=100\n');
}

if (require.main === module) main();
