import { defineConfig, devices } from '@playwright/test';

const origin = process.env.BILAN_VALIDATION_BASE_URL ?? 'http://127.0.0.1:3017';
// Le garde harnais local vit dans globalSetup : `--list` (garde de couverture des
// lanes) doit pouvoir charger cette config sans harnais, comme pour prod-smoke.
export default defineConfig({
  globalSetup: './e2e/bilan-validation/global-setup.ts',
  testDir: './e2e/bilan-validation', fullyParallel: false, workers: 1, retries: 0,
  timeout: 120_000, expect: { timeout: 20_000 }, reporter: [['list']],
  outputDir: 'test-results/bilan-validation',
  use: { baseURL: origin, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.BILAN_VALIDATION_CROSS_BROWSER === '1' ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: ['student.spec.ts','mobile-account.spec.ts','auth-hydration.spec.ts','terminale.spec.ts','enrichment.spec.ts'] },
      { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: ['student.spec.ts','mobile-account.spec.ts','auth-hydration.spec.ts','terminale.spec.ts','enrichment.spec.ts'] },
    ] : []),
  ],
});
