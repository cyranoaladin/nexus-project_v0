import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createCoverageMap, type CoverageMapData } from 'istanbul-lib-coverage';

const LANES = ['application', 'database', 'concurrency'] as const;
const COVERAGE_SOURCE_ROOTS = ['lib/aria/', 'app/api/aria/', 'components/aria/', 'scripts/aria/'] as const;
type AriaCoverageLane = typeof LANES[number];

interface ProcessResult {
  readonly status: number | null;
  readonly error?: Error;
}

interface AriaCoverageGenerationOptions {
  readonly repositoryRoot?: string;
  readonly gitOutput?: (args: readonly string[]) => string;
  readonly runProcess?: (command: string, args: readonly string[]) => ProcessResult;
}

export interface AriaCoverageGenerationEvidence {
  readonly schemaVersion: 1;
  readonly headSha: string;
  readonly lanes: typeof LANES;
  readonly laneArtifacts: Readonly<Record<AriaCoverageLane, string>>;
  readonly coverageFinalSha256: string;
  readonly coverageSummarySha256: string;
}

function assertCleanHead(
  readGitOutput: (args: readonly string[]) => string,
  expectedHead?: string,
): string {
  const head = readGitOutput(['rev-parse', 'HEAD']);
  if (expectedHead && head !== expectedHead) throw new Error('ARIA_COVERAGE_HEAD_CHANGED');
  if (readGitOutput(['status', '--porcelain=v1', '--untracked-files=all'])) {
    throw new Error('ARIA_COVERAGE_WORKTREE_NOT_CLEAN');
  }
  return head;
}

function run(
  command: string,
  args: readonly string[],
  execute: (command: string, args: readonly string[]) => ProcessResult,
): void {
  const result = execute(command, args);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ARIA_COVERAGE_LANE_FAILED:${command}:${result.status ?? 'SIGNAL'}`);
  }
}

function coverageDirectory(coverageRoot: string, lane: AriaCoverageLane): string {
  return resolve(coverageRoot, lane);
}

function runJestApplicationLane(
  coverageRoot: string,
  execute: (command: string, args: readonly string[]) => ProcessResult,
): void {
  const directory = coverageDirectory(coverageRoot, 'application');
  mkdirSync(directory, { recursive: true });
  run('npx', [
    'jest', '--config', 'jest.aria.coverage.config.js', '--runInBand',
    '--coverageProvider', 'babel', '--coverageDirectory', directory, '--coverageReporters', 'json',
    '--json', '--outputFile', resolve(directory, 'test-results.json'),
  ], execute);
}

function runDisposableLane(
  coverageRoot: string,
  lane: 'db' | 'concurrency',
  evidenceLane: 'database' | 'concurrency',
  execute: (command: string, args: readonly string[]) => ProcessResult,
): void {
  const directory = coverageDirectory(coverageRoot, evidenceLane);
  mkdirSync(directory, { recursive: true });
  run('bash', [
    'scripts/aria/run-disposable-db-suite.sh', lane,
    '--coverage', '--coverageProvider', 'babel', '--coverageDirectory', directory,
    '--coverageReporters', 'json', '--json', '--outputFile', resolve(directory, 'test-results.json'),
  ], execute);
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function generateAriaCoverage(
  options: AriaCoverageGenerationOptions = {},
): AriaCoverageGenerationEvidence {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const coverageRoot = resolve(repositoryRoot, '.artifacts/aria/coverage');
  const readGitOutput = options.gitOutput ?? ((args: readonly string[]) =>
    execFileSync('git', [...args], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim());
  const execute = options.runProcess ?? ((command: string, args: readonly string[]) => {
    const result = spawnSync(command, [...args], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: 'inherit',
    });
    return { status: result.status, error: result.error };
  });
  const headSha = assertCleanHead(readGitOutput);
  rmSync(coverageRoot, { recursive: true, force: true });
  mkdirSync(coverageRoot, { recursive: true });
  runJestApplicationLane(coverageRoot, execute);
  runDisposableLane(coverageRoot, 'db', 'database', execute);
  runDisposableLane(coverageRoot, 'concurrency', 'concurrency', execute);

  const merged = createCoverageMap({});
  const laneArtifacts: Record<AriaCoverageLane, string> = {
    application: '', database: '', concurrency: '',
  };
  for (const lane of LANES) {
    const path = resolve(coverageDirectory(coverageRoot, lane), 'coverage-final.json');
    if (!existsSync(path)) throw new Error(`ARIA_COVERAGE_LANE_ARTIFACT_MISSING:${lane}`);
    const bytes = readFileSync(path);
    laneArtifacts[lane] = sha256(bytes);
    const laneCoverage = createCoverageMap(JSON.parse(bytes.toString('utf8')) as CoverageMapData);
    laneCoverage.filter((filename) => {
      const repositoryPath = relative(repositoryRoot, filename).replaceAll('\\', '/');
      return COVERAGE_SOURCE_ROOTS.some((sourceRoot) => repositoryPath.startsWith(sourceRoot));
    });
    merged.merge(laneCoverage);
  }

  const coverageFinalPath = resolve(coverageRoot, 'coverage-final.json');
  writeFileSync(
    coverageFinalPath,
    `${JSON.stringify(merged.toJSON())}\n`,
    { mode: 0o600 },
  );
  const coverageFinalSha256 = sha256(readFileSync(coverageFinalPath));
  const summary: Record<string, unknown> = { total: merged.getCoverageSummary().toJSON() };
  for (const filename of merged.files().sort()) {
    summary[filename] = merged.fileCoverageFor(filename).toSummary().toJSON();
  }
  const coverageSummaryPath = resolve(coverageRoot, 'coverage-summary.json');
  writeFileSync(
    coverageSummaryPath,
    `${JSON.stringify(summary, null, 2)}\n`,
    { mode: 0o600 },
  );
  const coverageSummarySha256 = sha256(readFileSync(coverageSummaryPath));
  assertCleanHead(readGitOutput, headSha);
  const evidence = Object.freeze({
    schemaVersion: 1,
    headSha,
    lanes: LANES,
    laneArtifacts: Object.freeze(laneArtifacts),
    coverageFinalSha256,
    coverageSummarySha256,
  } as const);
  writeFileSync(
    resolve(coverageRoot, 'evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  return evidence;
}

if (require.main === module) {
  generateAriaCoverage();
}
