/** @jest-environment node */
const { readFileSync } = require('node:fs');

let workflow;
beforeAll(async () => {
  const { loadWorkflow } = await import('../../scripts/github/lib/aria-ci-contract.mjs');
  workflow = loadWorkflow('.github/workflows/ci.yml');
});
test.each(['e2e', 'e2e-auth', 'aria-browser', 'ci-success'])('%s uses the same exact PR source head', job => {
  const checkout = workflow.jobs[job].steps.find(step => step.uses?.startsWith('actions/checkout@'));
  expect(checkout.with.ref).toBe('${{ github.event.pull_request.head.sha || github.sha }}');
});
test('auth reports and traces are namespaced per invocation and mobile is executed', () => {
  const steps = workflow.jobs['e2e-auth'].steps;
  const chromium = steps.find(step => step.run?.includes('--project=chromium'));
  const cross = steps.find(step => step.run?.includes('--project=webkit-smoke'));
  expect(chromium.env.AUTH_E2E_REPORT_LABEL).toBe('auth-chromium');
  expect(cross.env.AUTH_E2E_REPORT_LABEL).toBe('auth-cross-browser');
  expect(cross.run).toContain('--project=mobile-smoke');
  const config = readFileSync('playwright.auth.config.ts', 'utf8');
  expect(config).toContain('outputDir: `test-results/${reportLabel}`');
  expect(config).toContain('playwright-report/${reportLabel}/results.json');
});
test('public lane writes a JSON execution report', () => {
  expect(readFileSync('playwright.ci.config.ts', 'utf8')).toContain("['json', { outputFile: 'playwright-report/public/results.json' }]");
});
test.each(['e2e', 'e2e-auth', 'aria-browser'])('%s always seals and uploads execution evidence', job => {
  const steps = workflow.jobs[job].steps;
  const seal = steps.find(step => step.run?.includes('e2e-execution-evidence.mjs seal'));
  expect(seal.if).toBe('always()');
  const upload = steps.find(step => step.uses?.startsWith('actions/upload-artifact@') && step.with.name.startsWith('e2e-execution-'));
  expect(upload.if).toBe('always()');
  expect(upload.with['if-no-files-found']).toBe('error');
  expect(upload.with.name).toContain('${{ github.run_id }}');
  expect(upload.with.name).toContain('${{ github.run_attempt }}');
});
test('required aggregate downloads separate envelopes and rejects incomplete execution', () => {
  const steps = workflow.jobs['ci-success'].steps;
  const download = steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
  expect(download.with.pattern).toContain('e2e-execution-*');
  expect(download.with['merge-multiple']).not.toBe(true);
  expect(steps.some(step => step.run?.includes('e2e-execution-evidence.mjs aggregate'))).toBe(true);
});
