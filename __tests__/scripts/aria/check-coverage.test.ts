import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  ARIA_CRITICAL_COVERAGE_SOURCES,
  checkAriaCoverage,
  runAriaCoverageCheck,
  validateAriaCoverageEvidence,
} from '@/scripts/aria/check-coverage';

const HEAD_SHA = 'a'.repeat(40);

function write(root: string, path: string, value: string): string {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
  return absolute;
}

function digest(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function metric(pct: number): object {
  return { total: 1, covered: pct === 100 ? 1 : 0, skipped: 0, pct };
}

function entry(pct: number): Record<string, object> {
  return {
    lines: metric(pct), functions: metric(pct),
    branches: metric(pct), statements: metric(pct),
  };
}

function coverageFixture(input: Readonly<{
  totalPct?: number;
  omitCritical?: string;
  criticalMetric?: 'lines' | 'functions' | 'branches' | 'statements';
}> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'aria-coverage-check-'));
  const coverageRoot = '.artifacts/aria/coverage';
  const artifactBytes = '{"fixture":true}\n';
  const laneArtifacts = {
    application: digest(artifactBytes),
    database: digest(artifactBytes),
    concurrency: digest(artifactBytes),
  };
  for (const lane of Object.keys(laneArtifacts)) {
    write(root, `${coverageRoot}/${lane}/coverage-final.json`, artifactBytes);
  }
  write(root, `${coverageRoot}/coverage-final.json`, artifactBytes);
  const summary: Record<string, object> = { total: entry(input.totalPct ?? 95) };
  for (const source of ARIA_CRITICAL_COVERAGE_SOURCES) {
    if (source === input.omitCritical) continue;
    const coverage = entry(100) as Record<string, object>;
    if (input.criticalMetric) coverage[input.criticalMetric] = metric(99);
    summary[join(root, source)] = coverage;
  }
  const summaryBytes = `${JSON.stringify(summary, null, 2)}\n`;
  write(root, `${coverageRoot}/coverage-summary.json`, summaryBytes);
  write(root, `${coverageRoot}/evidence.json`, `${JSON.stringify({
    schemaVersion: 1,
    headSha: HEAD_SHA,
    lanes: ['application', 'database', 'concurrency'],
    laneArtifacts,
    coverageFinalSha256: digest(artifactBytes),
    coverageSummarySha256: digest(summaryBytes),
  })}\n`);
  return root;
}

describe('ARIA coverage artifact gate', () => {
  it('accepts exact-head artifacts only when global and critical thresholds pass', () => {
    expect(checkAriaCoverage({
      repositoryRoot: coverageFixture(),
      headSha: HEAD_SHA,
    })).toEqual({
      lines: 95,
      functions: 95,
      branches: 95,
      statements: 95,
      criticalCoverage: 100,
    });
  });

  it('renders each observed metric through the CLI runner', () => {
    const output: string[] = [];
    expect(runAriaCoverageCheck({
      repositoryRoot: coverageFixture({ totalPct: 97.25 }),
      headSha: HEAD_SHA,
      write: (value) => output.push(value),
    })).toBe(0);
    expect(output.join('')).toBe([
      'ARIA_B_COVERAGE_LINES=97.25',
      'ARIA_B_COVERAGE_FUNCTIONS=97.25',
      'ARIA_B_COVERAGE_BRANCHES=97.25',
      'ARIA_B_COVERAGE_STATEMENTS=97.25',
      'ARIA_CRITICAL_COVERAGE=100',
      '',
    ].join('\n'));
  });

  it('fails closed on missing summary, evidence or lane artifacts', () => {
    const summary = coverageFixture();
    unlinkSync(join(summary, '.artifacts/aria/coverage/coverage-summary.json'));
    expect(() => checkAriaCoverage({ repositoryRoot: summary, headSha: HEAD_SHA }))
      .toThrow('ARIA_COVERAGE_GATE_FAILED:SUMMARY_MISSING');

    const evidence = coverageFixture();
    unlinkSync(join(evidence, '.artifacts/aria/coverage/evidence.json'));
    expect(() => checkAriaCoverage({ repositoryRoot: evidence, headSha: HEAD_SHA }))
      .toThrow('ARIA_COVERAGE_GATE_FAILED:EVIDENCE_MISSING');

    const lane = coverageFixture();
    unlinkSync(join(lane, '.artifacts/aria/coverage/database/coverage-final.json'));
    expect(() => checkAriaCoverage({ repositoryRoot: lane, headSha: HEAD_SHA }))
      .toThrow('ARIA_COVERAGE_GATE_FAILED:ARTIFACT_MISSING:database');
  });

  it.each(['lines', 'functions', 'branches', 'statements'] as const)(
    'rejects global %s below 95',
    (coverageMetric) => {
      const root = coverageFixture();
      const summary = { total: entry(95) } as Record<string, Record<string, unknown>>;
      for (const source of ARIA_CRITICAL_COVERAGE_SOURCES) summary[join(root, source)] = entry(100);
      summary.total![coverageMetric] = metric(94.99);
      const summaryBytes = `${JSON.stringify(summary)}\n`;
      write(root, '.artifacts/aria/coverage/coverage-summary.json', summaryBytes);
      const evidencePath = '.artifacts/aria/coverage/evidence.json';
      const evidence = JSON.parse(readFileSync(join(root, evidencePath), 'utf8'));
      write(root, evidencePath, `${JSON.stringify({
        ...evidence, coverageSummarySha256: digest(summaryBytes),
      })}\n`);
      expect(() => checkAriaCoverage({ repositoryRoot: root, headSha: HEAD_SHA }))
        .toThrow(`ARIA_COVERAGE_GATE_FAILED:GLOBAL_${coverageMetric.toUpperCase()}:94.99`);
    },
  );

  it('rejects missing critical sources and every non-100 critical metric', () => {
    const source = ARIA_CRITICAL_COVERAGE_SOURCES[0]!;
    expect(() => checkAriaCoverage({
      repositoryRoot: coverageFixture({ omitCritical: source }), headSha: HEAD_SHA,
    })).toThrow(`ARIA_COVERAGE_GATE_FAILED:CRITICAL_SOURCE_MISSING:${source}`);
    for (const coverageMetric of ['lines', 'functions', 'branches', 'statements'] as const) {
      expect(() => checkAriaCoverage({
        repositoryRoot: coverageFixture({ criticalMetric: coverageMetric }), headSha: HEAD_SHA,
      })).toThrow(`ARIA_COVERAGE_GATE_FAILED:CRITICAL_${source}:${coverageMetric}:99`);
    }
  });

  it('derives the current Git HEAD when no explicit head is supplied', () => {
    const root = coverageFixture();
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', [
      '-c', 'user.name=ARIA Test', '-c', 'user.email=aria@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ], { cwd: root });
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const evidencePath = join(root, '.artifacts/aria/coverage/evidence.json');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    writeFileSync(evidencePath, `${JSON.stringify({ ...evidence, headSha })}\n`);
    expect(checkAriaCoverage({ repositoryRoot: root })).toMatchObject({ criticalCoverage: 100 });
  });

  it('rejects malformed evidence fields and tampered merged artifacts', () => {
    const valid = {
      schemaVersion: 1 as const,
      headSha: HEAD_SHA,
      lanes: ['application', 'database', 'concurrency'] as const,
      laneArtifacts: {
        application: '1'.repeat(64), database: '2'.repeat(64), concurrency: '3'.repeat(64),
      },
      coverageFinalSha256: '4'.repeat(64),
      coverageSummarySha256: '5'.repeat(64),
    };
    expect(() => validateAriaCoverageEvidence(null, HEAD_SHA)).toThrow('EVIDENCE_SCHEMA');
    expect(() => validateAriaCoverageEvidence({ ...valid, headSha: 'bad' }, HEAD_SHA))
      .toThrow('EVIDENCE_SCHEMA');
    expect(() => validateAriaCoverageEvidence({ ...valid, laneArtifacts: {} }, HEAD_SHA))
      .toThrow('LANE_ARTIFACTS');
    expect(() => validateAriaCoverageEvidence({ ...valid, coverageFinalSha256: 'bad' }, HEAD_SHA))
      .toThrow('MERGED_ARTIFACTS');
    expect(() => validateAriaCoverageEvidence(valid, HEAD_SHA, {
      ...valid.laneArtifacts,
      coverageFinal: '9'.repeat(64),
      coverageSummary: valid.coverageSummarySha256,
    })).toThrow('ARTIFACT_TAMPERED:coverageFinal');
    expect(() => validateAriaCoverageEvidence(valid, HEAD_SHA, {
      ...valid.laneArtifacts,
      coverageFinal: valid.coverageFinalSha256,
      coverageSummary: '9'.repeat(64),
    })).toThrow('ARTIFACT_TAMPERED:coverageSummary');
  });
});
