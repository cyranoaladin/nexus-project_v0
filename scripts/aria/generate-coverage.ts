import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createCoverageMap, type CoverageMapData } from 'istanbul-lib-coverage';

const ROOT = process.cwd();
const COVERAGE_ROOT = resolve(ROOT, '.artifacts/aria/coverage');
const LANES = ['application', 'database', 'concurrency'] as const;
const COVERAGE_SOURCE_ROOTS = ['lib/aria/', 'app/api/aria/', 'components/aria/', 'scripts/aria/'] as const;

function gitOutput(args: readonly string[]): string {
  return execFileSync('git', [...args], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function assertCleanHead(expectedHead?: string): string {
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (expectedHead && head !== expectedHead) throw new Error('ARIA_COVERAGE_HEAD_CHANGED');
  if (gitOutput(['status', '--porcelain=v1', '--untracked-files=all'])) {
    throw new Error('ARIA_COVERAGE_WORKTREE_NOT_CLEAN');
  }
  return head;
}

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, { cwd: ROOT, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ARIA_COVERAGE_LANE_FAILED:${command}:${result.status ?? 'SIGNAL'}`);
  }
}

function coverageDirectory(lane: typeof LANES[number]): string {
  return resolve(COVERAGE_ROOT, lane);
}

function runJestApplicationLane(): void {
  const directory = coverageDirectory('application');
  mkdirSync(directory, { recursive: true });
  run('npx', [
    'jest', '--config', 'jest.aria.coverage.config.js', '--runInBand',
    '--coverageProvider', 'babel', '--coverageDirectory', directory, '--coverageReporters', 'json',
    '--json', '--outputFile', resolve(directory, 'test-results.json'),
  ]);
}

function runDisposableLane(lane: 'db' | 'concurrency', evidenceLane: 'database' | 'concurrency'): void {
  const directory = coverageDirectory(evidenceLane);
  mkdirSync(directory, { recursive: true });
  run('bash', [
    'scripts/aria/run-disposable-db-suite.sh', lane,
    '--coverage', '--coverageProvider', 'babel', '--coverageDirectory', directory,
    '--coverageReporters', 'json', '--json', '--outputFile', resolve(directory, 'test-results.json'),
  ]);
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function main(): void {
  const headSha = assertCleanHead();
  rmSync(COVERAGE_ROOT, { recursive: true, force: true });
  mkdirSync(COVERAGE_ROOT, { recursive: true });
  runJestApplicationLane();
  runDisposableLane('db', 'database');
  runDisposableLane('concurrency', 'concurrency');

  const merged = createCoverageMap({});
  const laneArtifacts: Record<typeof LANES[number], string> = {
    application: '', database: '', concurrency: '',
  };
  for (const lane of LANES) {
    const path = resolve(coverageDirectory(lane), 'coverage-final.json');
    const bytes = readFileSync(path);
    laneArtifacts[lane] = sha256(bytes);
    const laneCoverage = createCoverageMap(JSON.parse(bytes.toString('utf8')) as CoverageMapData);
    laneCoverage.filter((filename) => {
      const repositoryPath = relative(ROOT, filename).replaceAll('\\', '/');
      return COVERAGE_SOURCE_ROOTS.some((sourceRoot) => repositoryPath.startsWith(sourceRoot));
    });
    merged.merge(laneCoverage);
  }

  writeFileSync(
    resolve(COVERAGE_ROOT, 'coverage-final.json'),
    `${JSON.stringify(merged.toJSON())}\n`,
    { mode: 0o600 },
  );
  const coverageFinalSha256 = sha256(readFileSync(resolve(COVERAGE_ROOT, 'coverage-final.json')));
  const summary: Record<string, unknown> = { total: merged.getCoverageSummary().toJSON() };
  for (const filename of merged.files().sort()) {
    summary[filename] = merged.fileCoverageFor(filename).toSummary().toJSON();
  }
  writeFileSync(
    resolve(COVERAGE_ROOT, 'coverage-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    { mode: 0o600 },
  );
  const coverageSummarySha256 = sha256(readFileSync(resolve(COVERAGE_ROOT, 'coverage-summary.json')));
  assertCleanHead(headSha);
  writeFileSync(resolve(COVERAGE_ROOT, 'evidence.json'), `${JSON.stringify({
    schemaVersion: 1,
    headSha,
    lanes: LANES,
    laneArtifacts,
    coverageFinalSha256,
    coverageSummarySha256,
  }, null, 2)}\n`, { mode: 0o600 });
}

main();
