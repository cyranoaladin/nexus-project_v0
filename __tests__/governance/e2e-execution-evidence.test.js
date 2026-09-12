/** @jest-environment node */
let auditExecutionEvidence, sealReport, INVOCATIONS;
beforeAll(async () => {
  ({ auditExecutionEvidence, sealReport, INVOCATIONS } = await import('../../scripts/testing/e2e-execution-evidence.mjs'));
});

const identity = { sourceSha: 'a'.repeat(40), runId: '123', runAttempt: '1' };
function fixture() {
  const tracked = new Set();
  const evidence = Object.entries(INVOCATIONS).map(([lane, config]) => {
    const file = lane === 'public' ? 'public/example.spec.ts' : lane.startsWith('auth-') ? 'example.spec.ts' : `${lane}.spec.ts`;
    tracked.add(`${config.root}/${file}`);
    return sealReport(lane, {
      config: { rootDir: `/isolated/${config.root}`, projects: config.projects.map(name => ({ name, testMatch: [file], testIgnore: [] })) }, errors: [],
      suites: [{ suites: [{ specs: [{ file, title: 'complete flow', line: 10, column: 1, tests: config.projects.map(projectName => ({
        projectName, expectedStatus: 'passed', annotations: [], status: 'expected', results: [{ status: 'passed', retry: 0 }],
      })) }] }] }],
    }, identity);
  });
  return { tracked: [...tracked], evidence };
}
const firstTest = report => report.suites[0].suites[0].specs[0].tests[0];
function mutateFirst(f, change) {
  const report = structuredClone(f.evidence[0].report);
  change(report);
  f.evidence[0] = sealReport('public', report, identity);
}

test('reconciles nested reports and legitimate multi-browser file coverage', () => {
  const f = fixture();
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity)).toMatchObject({
    tracked: f.tracked.length, collected: f.tracked.length, executed: f.tracked.length, orphans: [], problems: [],
  });
});
test('distinguishes parameterized describe paths sharing one source location and leaf title', () => {
  const f = fixture();
  mutateFirst(f, report => {
    const suite = report.suites[0].suites[0];
    suite.title = 'parent';
    report.suites[0].suites.push({ ...structuredClone(suite), title: 'student' });
  });
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toEqual([]);
});
test('still rejects two records with the same complete describe path', () => {
  const f = fixture();
  mutateFirst(f, report => {
    const suite = report.suites[0].suites[0];
    suite.title = 'parent';
    report.suites[0].suites.push(structuredClone(suite));
  });
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toEqual([
    expect.stringMatching(/^DUPLICATE_TEST:/),
  ]);
});
test('one passing parameter cannot hide another parameter omitted from WebKit', () => {
  const f = fixture();
  for (const lane of ['auth-chromium', 'auth-cross-browser']) {
    const index = f.evidence.findIndex(entry => entry.lane === lane);
    const report = structuredClone(f.evidence[index].report);
    const suite = report.suites[0].suites[0];
    suite.title = 'parent';
    const other = { ...structuredClone(suite), title: 'student' };
    if (lane === 'auth-cross-browser') {
      other.specs[0].tests = other.specs[0].tests.filter(test => test.projectName !== 'webkit-smoke');
    }
    report.suites[0].suites.push(other);
    f.evidence[index] = sealReport(lane, report, identity);
  }
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toEqual([
    expect.stringMatching(/^MISSING_CROSS_BROWSER_TEST:webkit-smoke:/),
  ]);
});
test.each(['auth-chromium', 'aria-smoke'])('rejects the missing %s invocation', lane => {
  const f = fixture();
  f.evidence = f.evidence.filter(e => e.lane !== lane);
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toContain(`MISSING_INVOCATION:${lane}`);
});
test.each([
  ['unexecuted', t => { t.results = []; }],
  ['skipped', t => { t.results[0].status = 'skipped'; }],
  ['expected failure', t => { t.expectedStatus = 'failed'; }],
  ['retry', t => { t.results.push({ status: 'passed', retry: 1 }); }],
  ['fixme', t => { t.annotations.push({ type: 'fixme' }); }],
  ['flaky', t => { t.status = 'flaky'; }],
])('rejects %s even when another test in the same file passes', (_name, change) => {
  const f = fixture();
  mutateFirst(f, report => {
    const spec = structuredClone(report.suites[0].suites[0].specs[0]);
    spec.line = 20;
    report.suites[0].suites[0].specs.push(spec);
    change(firstTest(report));
  });
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems.length).toBeGreaterThan(0);
});
test('rejects mixed heads and attempts', () => {
  const f = fixture();
  f.evidence[0].sourceSha = 'b'.repeat(40);
  f.evidence[1].runAttempt = '2';
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toEqual(expect.arrayContaining([
    'IDENTITY_MISMATCH:public', 'IDENTITY_MISMATCH:auth-chromium',
  ]));
});
test('a smoke-project pass cannot replace a missing auth Chromium spec', () => {
  const f = fixture();
  const index = f.evidence.findIndex(e => e.lane === 'auth-cross-browser');
  const report = structuredClone(f.evidence[index].report);
  const spec = structuredClone(report.suites[0].suites[0].specs[0]);
  spec.file = 'smoke-only.spec.ts';
  report.suites[0].suites[0].specs.push(spec);
  f.evidence[index] = sealReport('auth-cross-browser', report, identity);
  f.tracked.push('e2e/auth/smoke-only.spec.ts');
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toContain('MISSING_PRIMARY_SPEC:auth-chromium:e2e/auth/smoke-only.spec.ts');
});
test.each(['file', 'test'])('rejects an omitted WebKit %s despite another passing WebKit record', kind => {
  const f = fixture();
  for (const lane of ['auth-chromium', 'auth-cross-browser']) {
    const index = f.evidence.findIndex(e => e.lane === lane);
    const report = structuredClone(f.evidence[index].report);
    const original = report.suites[0].suites[0].specs[0];
    const additional = structuredClone(original);
    additional.line = 20;
    if (kind === 'file') {
      additional.file = 'another.spec.ts';
      for (const project of report.config.projects) project.testMatch.push(additional.file);
    }
    report.suites[0].suites[0].specs.push(additional);
    if (lane === 'auth-cross-browser') original.tests = original.tests.filter(t => t.projectName !== 'webkit-smoke');
    f.evidence[index] = sealReport(lane, report, identity);
  }
  if (kind === 'file') f.tracked.push('e2e/auth/another.spec.ts');
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toEqual(expect.arrayContaining([
    expect.stringMatching(/^MISSING_CROSS_BROWSER_TEST:webkit-smoke:/),
  ]));
});
test('rejects report tampering, duplicate lanes and report-level errors', () => {
  const f = fixture();
  f.evidence[0].report.errors.push({ message: 'worker failed' });
  f.evidence.push(f.evidence[1]);
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toEqual(expect.arrayContaining([
    'REPORT_HASH_MISMATCH:public', 'REPORT_ERRORS:public', 'DUPLICATE_INVOCATION:auth-chromium',
  ]));
});
test('rejects untracked paths, path escapes, missing projects and absent tracked files', () => {
  const f = fixture();
  mutateFirst(f, report => { report.suites[0].suites[0].specs[0].file = '../../outside.spec.ts'; });
  f.tracked.push('e2e/auth/unexecuted.spec.ts');
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).orphans).toContain('e2e/auth/unexecuted.spec.ts');
  expect(auditExecutionEvidence(f.tracked, f.evidence, identity).problems).toContain('INVALID_PATH:public');
});
