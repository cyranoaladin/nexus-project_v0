import { defineConfig, devices } from '@playwright/test';

// Force E2E flags in the runner process
process.env.E2E = process.env.E2E || '1';
process.env.NEXT_PUBLIC_E2E = process.env.NEXT_PUBLIC_E2E || '1';
process.env.PLAYWRIGHT = '1';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['junit', { outputFile: 'junit-e2e.xml' }], ['line']] : 'line',
  use: {
    baseURL: BASE,
    testIdAttribute: 'data-testid',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
