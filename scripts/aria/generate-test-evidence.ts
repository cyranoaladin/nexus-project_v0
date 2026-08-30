import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  extractQualificationCasesFromJest,
  type AriaQualificationCase,
  type AriaQualificationLane,
} from './qualification-evidence';

const ROOT = process.cwd();
const ARTIFACT_ROOT = resolve(ROOT, '.artifacts/aria/qualification');

function git(...arguments_: string[]): string {
  return execFileSync('git', arguments_, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function assertClean(label: string): void {
  if (git('status', '--porcelain')) throw new Error(`ARIA_TEST_EVIDENCE_DIRTY_WORKTREE:${label}`);
}

function runJestLane(input: {
  readonly name: string;
  readonly lane: Exclude<AriaQualificationLane, 'e2e' | 'smoke'>;
  readonly command: string;
  readonly arguments: readonly string[];
}): readonly AriaQualificationCase[] {
  const rawPath = resolve(ARTIFACT_ROOT, `${input.name}.raw.json`);
  execFileSync(input.command, [...input.arguments, '--json', `--outputFile=${rawPath}`], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const document = JSON.parse(readFileSync(rawPath, 'utf8')) as { testResults?: unknown };
  return extractQualificationCasesFromJest(input.lane, document);
}

function main(): void {
  assertClean('BEFORE');
  const headSha = git('rev-parse', 'HEAD');
  rmSync(ARTIFACT_ROOT, { recursive: true, force: true });
  mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const lanes = [
    { name: 'unit', lane: 'unit', command: 'npx', arguments: ['jest', '--config', 'jest.aria.unit.config.js', '--runInBand'] },
    { name: 'api', lane: 'api', command: 'npx', arguments: ['jest', '--config', 'jest.aria.api.config.js', '--runInBand'] },
    { name: 'integration', lane: 'integration', command: 'npx', arguments: ['jest', '--config', 'jest.aria.integration.config.js', '--runInBand'] },
    { name: 'sse', lane: 'unit', command: 'npx', arguments: ['jest', '--config', 'jest.aria.sse.config.js', '--runInBand'] },
    { name: 'architecture', lane: 'architecture', command: 'npx', arguments: ['jest', '--config', 'jest.aria.architecture.config.js', '--runInBand'] },
    { name: 'database', lane: 'database', command: 'bash', arguments: ['scripts/aria/run-disposable-db-suite.sh', 'db'] },
    { name: 'concurrency', lane: 'concurrency', command: 'bash', arguments: ['scripts/aria/run-disposable-db-suite.sh', 'concurrency'] },
  ] as const;
  const cases = lanes.flatMap((lane) => runJestLane(lane));
  assertClean('AFTER');
  writeFileSync(resolve(ARTIFACT_ROOT, 'jest-evidence.json'), `${JSON.stringify({
    schemaVersion: 1,
    headSha,
    cases,
  }, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`ARIA_JEST_EVIDENCE_HEAD=${headSha}\n`);
  process.stdout.write(`ARIA_JEST_EVIDENCE_CASES=${cases.length}\n`);
}

main();
