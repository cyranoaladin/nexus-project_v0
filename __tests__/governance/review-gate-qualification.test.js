const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
const yaml = require('yaml');

let qualification;
const root = resolve(__dirname, '../..');
const corpusPath = resolve(root, 'scripts/github/review-gate/qualification/corpus.json');
const policyPath = resolve(root, 'scripts/github/review-gate/qualification/thresholds.json');

beforeAll(async () => {
  qualification = await import('../../scripts/github/review-gate/qualification/harness.mjs');
});

const response = (id, outcome, durationMs = 1000) => ({ id, outcome, durationMs, diffBytes: 4096 });

function withDisposableGitHistory(testBody) {
  const repoRoot = mkdtempSync(join(tmpdir(), 'nexus-review-corpus-'));
  const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    git('config', 'user.name', 'Synthetic Test');
    git('config', 'user.email', 'synthetic@example.invalid');
    writeFileSync(join(repoRoot, 'runtime.txt'), 'binaryTargets = ["debian-openssl-1.1.x"]\n');
    git('add', 'runtime.txt');
    git('commit', '-qm', 'synthetic baseline');
    writeFileSync(join(repoRoot, 'runtime.txt'), 'binaryTargets = ["debian-openssl-1.1.x", "debian-openssl-3.0.x"]\n');
    git('add', 'runtime.txt');
    git('commit', '-qm', 'synthetic correction');
    return testBody({ repoRoot, commit: git('rev-parse', 'HEAD') });
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe('historical semantic qualification corpus', () => {
  test('contains distinct, traceable blocking and benign incidents', () => {
    const corpus = qualification.validateCorpus(JSON.parse(readFileSync(corpusPath, 'utf8')));
    const blocking = corpus.cases.filter((item) => item.expected === 'BLOCKING_EXPECTED');
    const benign = corpus.cases.filter((item) => item.expected === 'NON_BLOCKING_EXPECTED');
    expect(blocking.length).toBeGreaterThanOrEqual(20);
    expect(benign.length).toBeGreaterThanOrEqual(20);
    expect(new Set(corpus.cases.map((item) => item.source.commit)).size).toBe(corpus.cases.length);
    expect(new Set(corpus.cases.map((item) => item.id)).size).toBe(corpus.cases.length);
    expect(corpus.cases.every((item) => item.incident && item.family && item.source.path)).toBe(true);
    expect(corpus.cases.some((item) => item.family === 'prisma-openssl')).toBe(true);
    expect(corpus.cases.some((item) => item.family === 'pdfjs-standalone')).toBe(true);
    expect(corpus.cases.some((item) => item.family === 'preview-storage')).toBe(true);
    expect(corpus.cases.some((item) => item.family === 'auth-session')).toBe(true);
  });

  test('reconstructs a bounded reverse patch without fixture labels using disposable Git history', () => {
    withDisposableGitHistory(({ repoRoot, commit }) => {
      const item = { source: { commit, path: 'runtime.txt', direction: 'reverse' },
        incident: 'synthetic fixture' };
      const evidence = qualification.materializeHistoricalCase(item, { repoRoot });
      expect(evidence.diff).toMatch(/^@@ /);
      expect(evidence.diff).toContain('binaryTargets');
      expect(evidence.diffBytes).toBeGreaterThan(0);
      const input = qualification.toModelData(evidence);
      expect(input).toContain('binaryTargets');
      expect(input).not.toContain('BLOCKING_EXPECTED');
      expect(input).not.toContain(item.incident);
      expect(input).not.toContain(item.source.commit);
    });
  });

  test('materialized patches obey the declared budget and missing history fails closed', () => {
    const policy = qualification.validateThresholds(JSON.parse(readFileSync(policyPath, 'utf8')));
    withDisposableGitHistory(({ repoRoot, commit }) => {
      const item = { source: { commit, path: 'runtime.txt', direction: 'forward' } };
      const evidence = qualification.materializeHistoricalCase(item, { repoRoot });
      expect(evidence.diffBytes).toBeLessThanOrEqual(policy.maximumDiffBytes);
      expect(evidence.diff).toMatch(/^@@ /);
      expect(() => qualification.materializeHistoricalCase({ source: {
        ...item.source, commit: 'a'.repeat(40),
      } }, { repoRoot })).toThrow('CORPUS_PATCH_UNAVAILABLE');
    });
  });

  test('rejects malformed provenance and paths before invoking git', () => {
    const item = {
      id: 'bad', family: 'auth-session', incident: 'synthetic',
      expected: 'BLOCKING_EXPECTED', severity: 'P1',
      source: { commit: 'a'.repeat(40), path: '../outside', direction: 'reverse' },
    };
    expect(() => qualification.materializeHistoricalCase(item, { repoRoot: root })).toThrow();
  });
});

describe('frozen metrics and fail-closed qualification', () => {
  test('the hosted comparison first exercises a bounded synthetic model invocation', () => {
    const workflow = yaml.parse(readFileSync(resolve(root,
      '.github/workflows/nexus-review-gate-model-qualification.yml'), 'utf8'));
    const diagnostic = workflow.jobs['compare-models'].steps.find((step) =>
      step.name === 'Diagnose model invocation with synthetic prompt');
    expect(diagnostic.run).toContain('timeout 120');
    expect(diagnostic.run).toContain('MODEL_SYNTHETIC_SMOKE=');
    expect(diagnostic.run).not.toContain('github.event.pull_request.body');
  });
  test('thresholds are versioned and fixed before model execution', () => {
    const policy = qualification.validateThresholds(JSON.parse(readFileSync(policyPath, 'utf8')));
    expect(policy.minimumBlockingCases).toBeGreaterThanOrEqual(20);
    expect(policy.minimumBenignCases).toBeGreaterThanOrEqual(20);
    expect(policy.minimumSecurityGovernanceRecall).toBe(1);
    expect(policy.maximumFalsePositiveRate).toBeLessThanOrEqual(0.1);
    expect(policy.maximumP95RuntimeMs).toBeLessThanOrEqual(480000);
    expect(() => qualification.validateThresholds({ ...policy, minimumDetectionRecall: 0.1 }))
      .toThrow('QUALIFICATION_THRESHOLDS_INVALID');
    expect(() => qualification.validateThresholds({ ...policy, maximumFalsePositiveRate: 0.5 }))
      .toThrow('QUALIFICATION_THRESHOLDS_INVALID');
  });

  test('perfect pilot results measure thresholds but do not confer unvetted merge authority', () => {
    const corpus = qualification.validateCorpus(JSON.parse(readFileSync(corpusPath, 'utf8')));
    const policy = qualification.validateThresholds(JSON.parse(readFileSync(policyPath, 'utf8')));
    const answers = corpus.cases.map((item, index) => response(item.id,
      item.expected === 'BLOCKING_EXPECTED' ? 'BLOCK' : 'CLEAN', 1000 + index));
    const result = qualification.scoreQualification(corpus, answers, policy);
    expect(result.thresholdsMet).toBe(true);
    expect(result.qualified).toBe(false);
    expect(result.reason).toBe('CORPUS_VETTING_REQUIRED');
    expect(result.metrics).toEqual(expect.objectContaining({
      detectionRecall: 1,
      falsePositiveRate: 0,
      malformedOutputRate: 0,
      timeoutRate: 0,
      medianRuntimeMs: expect.any(Number),
      p95RuntimeMs: expect.any(Number),
    }));
  });

  test('missing outcomes, model timeouts and malformed outputs cannot qualify', () => {
    const corpus = qualification.validateCorpus(JSON.parse(readFileSync(corpusPath, 'utf8')));
    const policy = qualification.validateThresholds(JSON.parse(readFileSync(policyPath, 'utf8')));
    const answers = corpus.cases.map((item) => response(item.id,
      item.expected === 'BLOCKING_EXPECTED' ? 'BLOCK' : 'CLEAN'));
    expect(qualification.scoreQualification(corpus, answers.slice(1), policy).qualified).toBe(false);
    const withoutSize = [{ ...answers[0], diffBytes: undefined }, ...answers.slice(1)];
    expect(qualification.scoreQualification(corpus, withoutSize, policy).reason)
      .toBe('EVIDENCE_INCOMPLETE_OR_INVALID');
    expect(qualification.scoreQualification(corpus, [response(corpus.cases[0].id, 'TIMEOUT'), ...answers.slice(1)], policy).qualified).toBe(false);
    expect(qualification.scoreQualification(corpus, [response(corpus.cases[0].id, 'MALFORMED'), ...answers.slice(1)], policy).qualified).toBe(false);
  });

  test('a security/governance blocker silently missed prevents qualification', () => {
    const corpus = qualification.validateCorpus(JSON.parse(readFileSync(corpusPath, 'utf8')));
    const policy = qualification.validateThresholds(JSON.parse(readFileSync(policyPath, 'utf8')));
    const answers = corpus.cases.map((item) => response(item.id,
      item.expected === 'BLOCKING_EXPECTED' ? 'BLOCK' : 'CLEAN'));
    const critical = corpus.cases.find((item) => item.expected === 'BLOCKING_EXPECTED' &&
      ['security', 'governance'].includes(item.domain));
    answers.find((item) => item.id === critical.id).outcome = 'CLEAN';
    const result = qualification.scoreQualification(corpus, answers, policy);
    expect(result.qualified).toBe(false);
    expect(result.metrics.securityGovernanceRecall).toBeLessThan(1);
  });

  test('false positives above the frozen limit refuse qualification', () => {
    const corpus = qualification.validateCorpus(JSON.parse(readFileSync(corpusPath, 'utf8')));
    const policy = qualification.validateThresholds(JSON.parse(readFileSync(policyPath, 'utf8')));
    const answers = corpus.cases.map((item) => response(item.id,
      item.expected === 'BLOCKING_EXPECTED' ? 'BLOCK' : 'CLEAN'));
    for (const item of answers.filter((answer) =>
      corpus.cases.find((entry) => entry.id === answer.id)?.expected === 'NON_BLOCKING_EXPECTED').slice(0, 3)) {
      item.outcome = 'BLOCK';
    }
    expect(qualification.scoreQualification(corpus, answers, policy).qualified).toBe(false);
  });

  test('an unsupported or oversized diff fails thresholds even when other answers are perfect', () => {
    const corpus = qualification.validateCorpus(JSON.parse(readFileSync(corpusPath, 'utf8')));
    const policy = qualification.validateThresholds(JSON.parse(readFileSync(policyPath, 'utf8')));
    const answers = corpus.cases.map((item) => response(item.id,
      item.expected === 'BLOCKING_EXPECTED' ? 'BLOCK' : 'CLEAN'));
    const unsupported = [response(answers[0].id, 'UNSUPPORTED'), ...answers.slice(1)];
    expect(qualification.scoreQualification(corpus, unsupported, policy).thresholdsMet).toBe(false);
    const oversized = [{ ...answers[0], diffBytes: policy.maximumDiffBytes + 1 }, ...answers.slice(1)];
    expect(qualification.scoreQualification(corpus, oversized, policy).thresholdsMet).toBe(false);
  });
});
