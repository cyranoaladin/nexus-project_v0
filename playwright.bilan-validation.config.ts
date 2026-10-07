import { defineConfig, devices } from '@playwright/test';

const origin = process.env.BILAN_VALIDATION_BASE_URL ?? 'http://127.0.0.1:3017';
const url = new URL(origin);
if (process.env.BILAN_VALIDATION_LOCAL !== '1' || url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '3017') {
  throw new Error('BILAN_VALIDATION_LOCAL_HARNESS_REQUIRED');
}
export default defineConfig({
  testDir: './e2e/bilan-validation', fullyParallel: false, workers: 1, retries: 0,
  timeout: 120_000, expect: { timeout: 20_000 }, reporter: [['list']],
  outputDir: 'test-results/bilan-validation',
  use: { baseURL: origin, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.BILAN_VALIDATION_CROSS_BROWSER === '1' ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: ['student.spec.ts','mobile-account.spec.ts','auth-hydration.spec.ts'] },
      { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: ['student.spec.ts','mobile-account.spec.ts','auth-hydration.spec.ts'] },
    ] : []),
  ],
});
