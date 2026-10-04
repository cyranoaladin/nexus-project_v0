const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const COMMAND = 'npx playwright test --config=playwright.auth.config.ts --project=mobile-smoke password-change.spec.ts password-change-v1.spec.ts --grep=390px --repeat-each=20 --workers=1 --retries=0';
let loadWorkflow;
let qualifyAccountSecurityRepeat;
let sanitizePlaywrightReport;
beforeAll(async () => {
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
    suites: [{ specs: cases.map(([file, title]) => ({ file, title, ok: true,
      tests: Array.from({ length: 20 }, () => ({ projectName: 'mobile-smoke', expectedStatus: 'passed',
        status: 'expected', annotations: [], results: [{ status: 'passed', retry: 0, errors: [] }] })),
    })), suites: [] }],
  });
}

test('twenty genuine records per approved case qualify after privacy publishing', () => {
  expect(qualifyAccountSecurityRepeat(successfulReport())).toEqual({
    project: 'mobile-smoke', cases: 2, repetitionsPerCase: 20, passed: 40, skipped: 0, retries: 0,
  });
});

test.each([
  ['nineteen repetitions', r => { r.suites[0].specs[0].tests.pop(); }],
  ['duplicated case', r => { r.suites[0].specs[1] = structuredClone(r.suites[0].specs[0]); }],
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
