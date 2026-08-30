import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  extractQualificationCasesFromJest,
  type AriaQualificationCase,
  type AriaQualificationLane,
} from './qualification-evidence';

export const ARIA_QUALIFICATION_LANES = [
  { name: 'unit', lane: 'unit', command: 'npx', arguments: ['jest', '--config', 'jest.aria.unit.config.js', '--runInBand'] },
  { name: 'api', lane: 'api', command: 'npx', arguments: ['jest', '--config', 'jest.aria.api.config.js', '--runInBand'] },
  { name: 'integration', lane: 'integration', command: 'npx', arguments: ['jest', '--config', 'jest.aria.integration.config.js', '--runInBand'] },
  { name: 'sse', lane: 'unit', command: 'npx', arguments: ['jest', '--config', 'jest.aria.sse.config.js', '--runInBand'] },
  { name: 'architecture', lane: 'architecture', command: 'npx', arguments: ['jest', '--config', 'jest.aria.architecture.config.js', '--runInBand'] },
  { name: 'database', lane: 'database', command: 'bash', arguments: ['scripts/aria/run-disposable-db-suite.sh', 'db'] },
  { name: 'concurrency', lane: 'concurrency', command: 'bash', arguments: ['scripts/aria/run-disposable-db-suite.sh', 'concurrency'] },
] as const;

interface AriaTestEvidenceDependencies {
  readonly git?: (...arguments_: string[]) => string;
  readonly execute?: typeof execFileSync;
  readonly write?: (value: string) => void;
}

function runJestLane(input: {
  readonly name: string;
  readonly lane: Exclude<AriaQualificationLane, 'e2e' | 'smoke'>;
  readonly command: string;
  readonly arguments: readonly string[];
}, repositoryRoot: string, artifactRoot: string, execute: typeof execFileSync): readonly AriaQualificationCase[] {
  const rawPath = resolve(artifactRoot, `${input.name}.raw.json`);
  execute(input.command, [...input.arguments, '--json', `--outputFile=${rawPath}`], {
    cwd: repositoryRoot,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const document = JSON.parse(readFileSync(rawPath, 'utf8')) as { testResults?: unknown };
  return extractQualificationCasesFromJest(input.lane, document);
}

export function generateAriaTestEvidence(
  repositoryRoot: string,
  dependencies: AriaTestEvidenceDependencies = {},
): Readonly<{ headSha: string; cases: readonly AriaQualificationCase[] }> {
  const artifactRoot = resolve(repositoryRoot, '.artifacts/aria/qualification');
  const git = dependencies.git ?? ((...arguments_: string[]) => execFileSync(
    'git', arguments_, { cwd: repositoryRoot, encoding: 'utf8' },
  ).trim());
  const assertClean = (label: string): void => {
    if (git('status', '--porcelain')) throw new Error(`ARIA_TEST_EVIDENCE_DIRTY_WORKTREE:${label}`);
  };
  assertClean('BEFORE');
  const headSha = git('rev-parse', 'HEAD');
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(artifactRoot, { recursive: true });
  const execute = dependencies.execute ?? execFileSync;
  const cases = ARIA_QUALIFICATION_LANES.flatMap((lane) => runJestLane(
    lane,
    repositoryRoot,
    artifactRoot,
    execute,
  ));
  assertClean('AFTER');
  writeFileSync(resolve(artifactRoot, 'jest-evidence.json'), `${JSON.stringify({
    schemaVersion: 1,
    headSha,
    cases,
  }, null, 2)}\n`, { flag: 'wx' });
  const write = dependencies.write ?? ((value: string) => process.stdout.write(value));
  write(`ARIA_JEST_EVIDENCE_HEAD=${headSha}\n`);
  write(`ARIA_JEST_EVIDENCE_CASES=${cases.length}\n`);
  return Object.freeze({ headSha, cases: Object.freeze(cases) });
}

if (require.main === module) generateAriaTestEvidence(process.cwd());
