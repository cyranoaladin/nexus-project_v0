let path;
let ROOT;
const COMMAND = 'npx playwright test --config=playwright.auth.config.ts --project=mobile-smoke password-change.spec.ts password-change-v1.spec.ts --grep=390px --repeat-each=20 --workers=1 --retries=0';
let loadWorkflow;
let qualifyAccountSecurityRepeat;
let sanitizePlaywrightReport;
beforeAll(async () => {
  path = await import('node:path');
  ROOT = path.resolve(__dirname, '../..');
  ({ loadWorkflow } = await import('../../scripts/github/lib/aria-ci-contract.mjs'));
  ({ qualifyAccountSecurityRepeat } = await import('../../scripts/testing/check-account-security-repeat.mjs'));
  ({ sanitizePlaywrightReport } = await import('../../scripts/testing/safe-playwright-report.mjs'));
});

test('the required auth job runs twenty real mobile security repetitions without retries', () => {
  const job = loadWorkflow(path.join(ROOT, '.github/workflows/ci.yml')).jobs['e2e-auth-cross-browser'];
  const step = job.steps.find(step => step.name === 'Repeat mobile account security twenty times');
  expect(step).toBeDefined();
  expect(step.run).toBe(COMMAND);
  expect(step.env.AUTH_E2E_REPORT_LABEL).toBe('auth-account-security-repeat20');
  expect(step['continue-on-error']).toBeUndefined();
  expect(step.if).toBeUndefined();
});

test('security repetitions are qualified and published only through the private-data-free publisher', () => {
  const steps = loadWorkflow(path.join(ROOT, '.github/workflows/ci.yml')).jobs['e2e-auth-cross-browser'].steps;
  const seal = steps.find(step => step.name === 'Qualify mobile account security repetition evidence');
  expect(seal).toBeDefined();
  expect(seal.run).toContain('node scripts/testing/safe-playwright-report.mjs playwright-report/auth-account-security-repeat20/results.json .artifacts/publish/auth-account-security-repeat20/report.json');
  expect(seal.run).toContain('node scripts/testing/check-account-security-repeat.mjs .artifacts/publish/auth-account-security-repeat20/report.json');
  const upload = steps.find(step => step.with?.name?.startsWith('account-security-repeat20-'));
  expect(upload.with.path).toBe('.artifacts/publish/auth-account-security-repeat20/');
  expect(upload.with.name).toContain('github.event.pull_request.head.sha');
  expect(upload.with['if-no-files-found']).toBe('error');
});


function successfulReport() {
  const cases = [
    ['password-change.spec.ts', 'parent changes their password and revokes both old sessions at 390px'],
    ['password-change-v1.spec.ts', 'V1 parent changes their password and revokes two sessions at 390px'],
  ];
  return sanitizePlaywrightReport({
    config: { rootDir: '/synthetic/repo/e2e/auth' }, errors: [],
    stats: { expected: 40, skipped: 0, unexpected: 0, flaky: 0 },
    suites: [{ specs: cases.flatMap(([file, title]) => Array.from({ length: 20 }, (_, repetition) => ({
      id: `${file}-repeat-${repetition}`, file, title, ok: true,
      tests: [{ projectName: 'mobile-smoke', expectedStatus: 'passed',
        status: 'expected', annotations: [], results: [{ status: 'passed', retry: 0, errors: [] }] }],
    }))), suites: [] }],
  });
}

test('twenty genuine records per approved case qualify after privacy publishing', () => {
  expect(qualifyAccountSecurityRepeat(successfulReport())).toEqual({
    project: 'mobile-smoke', cases: 2, repetitionsPerCase: 20, passed: 40, skipped: 0, retries: 0,
  });
});

test.each([
  ['duplicate execution identity', r => { r.suites[0].specs[1].executionId = r.suites[0].specs[0].executionId; }],
  ['missing execution identity', r => { delete r.suites[0].specs[0].executionId; }],
  ['nineteen repetitions', r => { r.suites[0].specs.pop(); }],
  ['duplicated case', r => { r.suites[0].specs[20] = structuredClone(r.suites[0].specs[0]); }],
  ['wrong viewport signature', r => { r.suites[0].specs[0].title = 'case:' + 'a'.repeat(64); }],
  ['wrong browser project', r => { r.suites[0].specs[0].tests[0].projectName = 'chromium'; }],
  ['skipped status', r => { r.suites[0].specs[0].tests[0].results[0].status = 'skipped'; }],
  ['skipped annotation', r => { r.suites[0].specs[0].tests[0].annotations.push({ type: 'skip' }); }],
  ['expected failure', r => { r.suites[0].specs[0].tests[0].expectedStatus = 'failed'; }],
  ['retry', r => { r.suites[0].specs[0].tests[0].results[0].retry = 1; }],
  ['extra execution', r => { r.suites[0].specs[0].tests[0].results.push(structuredClone(r.suites[0].specs[0].tests[0].results[0])); }],
  ['browser error', r => { r.suites[0].specs[0].tests[0].results[0].errors.push({ message: 'PRIVATE_DIAGNOSTIC_REDACTED' }); }],
  ['global error', r => { r.errors.push({ message: 'PRIVATE_DIAGNOSTIC_REDACTED' }); }],
  ['flaky summary', r => { r.stats.flaky = 1; }],
  ['wrong total', r => { r.stats.expected = 39; }],
  ['raw report', r => { delete r.privacyFormat; }],
  ['unexpected suite', r => { r.suites.push(structuredClone(r.suites[0])); }],
])('qualification refuses %s even if other summary counts are green', (_name, mutate) => {
  const report = successfulReport(); mutate(report);
  expect(() => qualifyAccountSecurityRepeat(report)).toThrow('ACCOUNT_SECURITY_REPEAT_EVIDENCE_INVALID');
});


test('privacy publisher retains only fixed ARIA phase timings and redacts nested diagnostics', () => {
  const raw = { config: { rootDir: '/synthetic/repo/e2e/aria' }, errors: [], stats: {},
    suites: [{ specs: [{ file: 'visual-a11y.spec.ts', title: 'E019 visual',
      tests: [{ projectName: 'aria-mobile', results: [{ status: 'timedOut', steps: [
        { title: 'ARIA_PHASE:rag:send', duration: 12, steps: [
          { title: 'ARIA_PHASE:transport:request', duration: 3 },
          { title: 'PRIVATE_PHASE_CANARY', duration: 4, steps: [
            { title: 'ARIA_PHASE:transport:body', duration: 29, error: { message: 'PRIVATE_ERROR_CANARY' } },
            { title: 'ARIA_PHASE:transport:aborted', duration: 0, error: { message: 'PRIVATE_TRANSPORT_CANARY' } },
          ] },
        ] },
        { title: 'ARIA_PHASE:rag:alert', duration: 6 },
      ] }] }] }] }],
  };
  const report = sanitizePlaywrightReport(raw);
  const result = report.suites[0].specs[0].tests[0].results[0];
  expect(result.phases).toEqual([
    { phase: 'ARIA_PHASE:rag:send', duration: 12, failed: false },
    { phase: 'ARIA_PHASE:transport:request', duration: 3, failed: false },
    { phase: 'ARIA_PHASE:transport:body', duration: 29, failed: true },
    { phase: 'ARIA_PHASE:transport:aborted', duration: 0, failed: true },
    { phase: 'ARIA_PHASE:rag:alert', duration: 6, failed: false },
  ]);
  expect(JSON.stringify(report)).not.toContain('PRIVATE_PHASE_CANARY');
  expect(JSON.stringify(report)).not.toContain('PRIVATE_ERROR_CANARY');
  expect(JSON.stringify(report)).not.toContain('PRIVATE_TRANSPORT_CANARY');
  expect(sanitizePlaywrightReport(report)).toEqual(report);
});
