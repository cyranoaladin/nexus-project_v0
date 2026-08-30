import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { generateAriaCoverage } from '@/scripts/aria/generate-coverage';

const HEAD_SHA = 'a'.repeat(40);

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'aria-coverage-'));
}

function fileCoverage(path: string): object {
  return {
    path,
    statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } },
    fnMap: {
      0: {
        name: 'covered', decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
        loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } }, line: 1,
      },
    },
    branchMap: {
      0: {
        type: 'if', line: 1,
        locations: [
          { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
          { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
        ],
      },
    },
    s: { 0: 1 },
    f: { 0: 1 },
    b: { 0: [1, 1] },
  };
}

function writeCoverage(path: string, sources: readonly string[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(Object.fromEntries(
    sources.map((source) => [source, fileCoverage(source)]),
  ))}\n`);
}

function coverageDirectoryFrom(args: readonly string[]): string {
  const index = args.indexOf('--coverageDirectory');
  if (index < 0 || !args[index + 1]) throw new Error('fixture missing coverage directory');
  return args[index + 1];
}

function cleanGitOutput(heads: readonly string[] = [HEAD_SHA, HEAD_SHA]) {
  let headIndex = 0;
  return (args: readonly string[]): string => args[0] === 'status'
    ? ''
    : heads[headIndex++] ?? heads[heads.length - 1]!;
}

describe('ARIA exact-head coverage producer', () => {
  it('runs all three lanes, filters non-ARIA sources and writes digest-bound merged evidence', () => {
    const root = fixtureRoot();
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const laneSources = [
      [join(root, 'lib/aria/application.ts'), join(root, 'other/not-aria.ts')],
      [join(root, 'app/api/aria/chat/route.ts')],
      [join(root, 'scripts/aria/check.ts')],
    ];
    let laneIndex = 0;

    const evidence = generateAriaCoverage({
      repositoryRoot: root,
      gitOutput: cleanGitOutput(),
      runProcess: (command, args) => {
        calls.push({ command, args });
        const directory = coverageDirectoryFrom(args);
        writeCoverage(join(directory, 'coverage-final.json'), laneSources[laneIndex++]!);
        return { status: 0 };
      },
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ command: 'npx' });
    expect(calls[0]!.args).toEqual(expect.arrayContaining([
      'jest', '--config', 'jest.aria.coverage.config.js', '--runInBand',
    ]));
    expect(calls[1]).toMatchObject({ command: 'bash' });
    expect(calls[1]!.args).toEqual(expect.arrayContaining([
      'scripts/aria/run-disposable-db-suite.sh', 'db',
    ]));
    expect(calls[2]!.args).toEqual(expect.arrayContaining([
      'scripts/aria/run-disposable-db-suite.sh', 'concurrency',
    ]));

    const mergedPath = join(root, '.artifacts/aria/coverage/coverage-final.json');
    const merged = JSON.parse(readFileSync(mergedPath, 'utf8')) as Record<string, unknown>;
    expect(Object.keys(merged).sort()).toEqual([
      join(root, 'app/api/aria/chat/route.ts'),
      join(root, 'lib/aria/application.ts'),
      join(root, 'scripts/aria/check.ts'),
    ].sort());
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      headSha: HEAD_SHA,
      lanes: ['application', 'database', 'concurrency'],
      coverageFinalSha256: createHash('sha256').update(readFileSync(mergedPath)).digest('hex'),
    });
    expect(Object.values(evidence.laneArtifacts)).toHaveLength(3);
    expect(Object.values(evidence.laneArtifacts).every((digest) => /^[a-f0-9]{64}$/.test(digest)))
      .toBe(true);
    expect(statSync(join(root, '.artifacts/aria/coverage/evidence.json')).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(
      join(root, '.artifacts/aria/coverage/coverage-summary.json'), 'utf8',
    ))).toMatchObject({
      total: {
        lines: { pct: 100 }, functions: { pct: 100 },
        branches: { pct: 100 }, statements: { pct: 100 },
      },
    });
  });

  it('rejects a dirty worktree before running any lane and after lane execution', () => {
    const root = fixtureRoot();
    const runProcess = jest.fn();
    expect(() => generateAriaCoverage({
      repositoryRoot: root,
      gitOutput: (args) => args[0] === 'status' ? ' M dirty.ts' : HEAD_SHA,
      runProcess,
    })).toThrow('ARIA_COVERAGE_WORKTREE_NOT_CLEAN');
    expect(runProcess).not.toHaveBeenCalled();

    let statusCalls = 0;
    expect(() => generateAriaCoverage({
      repositoryRoot: fixtureRoot(),
      gitOutput: (args) => args[0] === 'status'
        ? (++statusCalls === 1 ? '' : '?? late.ts')
        : HEAD_SHA,
      runProcess: (_command, args) => {
        writeCoverage(join(coverageDirectoryFrom(args), 'coverage-final.json'), []);
        return { status: 0 };
      },
    })).toThrow('ARIA_COVERAGE_WORKTREE_NOT_CLEAN');
  });

  it('rejects a HEAD change, failed process, signalled process and spawn error', () => {
    expect(() => generateAriaCoverage({
      repositoryRoot: fixtureRoot(),
      gitOutput: cleanGitOutput([HEAD_SHA, 'b'.repeat(40)]),
      runProcess: (_command, args) => {
        writeCoverage(join(coverageDirectoryFrom(args), 'coverage-final.json'), []);
        return { status: 0 };
      },
    })).toThrow('ARIA_COVERAGE_HEAD_CHANGED');

    for (const result of [
      { status: 2 },
      { status: null },
      { status: null, error: new Error('spawn unavailable') },
    ]) {
      expect(() => generateAriaCoverage({
        repositoryRoot: fixtureRoot(),
        gitOutput: cleanGitOutput(),
        runProcess: () => result,
      })).toThrow(result.error ?? `ARIA_COVERAGE_LANE_FAILED:npx:${result.status ?? 'SIGNAL'}`);
    }
  });

  it('fails closed when a successful lane does not produce its coverage artifact', () => {
    expect(() => generateAriaCoverage({
      repositoryRoot: fixtureRoot(),
      gitOutput: cleanGitOutput(),
      runProcess: () => ({ status: 0 }),
    })).toThrow('ARIA_COVERAGE_LANE_ARTIFACT_MISSING:application');
  });

  it('uses the real Git and process adapters when invoked without injected dependencies', () => {
    const root = fixtureRoot();
    const source = join(root, 'lib/aria/default-adapter.ts');
    const coverageFixture = join(root, 'coverage-fixture.json');
    writeCoverage(coverageFixture, [source]);
    mkdirSync(join(root, 'bin'), { recursive: true });
    mkdirSync(join(root, 'scripts/aria'), { recursive: true });
    const runner = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'coverage_directory=""',
      'while [ "$#" -gt 0 ]; do',
      '  if [ "$1" = "--coverageDirectory" ]; then coverage_directory="$2"; shift 2; else shift; fi',
      'done',
      'mkdir -p "$coverage_directory"',
      'cp "$ARIA_COVERAGE_FIXTURE_PATH" "$coverage_directory/coverage-final.json"',
      '',
    ].join('\n');
    writeFileSync(join(root, 'bin/npx'), runner);
    writeFileSync(join(root, 'scripts/aria/run-disposable-db-suite.sh'), runner);
    chmodSync(join(root, 'bin/npx'), 0o700);
    chmodSync(join(root, 'scripts/aria/run-disposable-db-suite.sh'), 0o700);
    writeFileSync(join(root, '.gitignore'), '.artifacts/\n');
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', [
      '-c', 'user.name=ARIA Test', '-c', 'user.email=aria@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ], { cwd: root });
    const previousDirectory = process.cwd();
    const previousPath = process.env.PATH;
    const previousFixture = process.env.ARIA_COVERAGE_FIXTURE_PATH;
    try {
      process.chdir(root);
      process.env.PATH = `${join(root, 'bin')}:${previousPath ?? ''}`;
      process.env.ARIA_COVERAGE_FIXTURE_PATH = coverageFixture;
      expect(generateAriaCoverage()).toMatchObject({
        headSha: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root, encoding: 'utf8',
        }).trim(),
      });
    } finally {
      process.chdir(previousDirectory);
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      if (previousFixture === undefined) delete process.env.ARIA_COVERAGE_FIXTURE_PATH;
      else process.env.ARIA_COVERAGE_FIXTURE_PATH = previousFixture;
    }
  });
});
