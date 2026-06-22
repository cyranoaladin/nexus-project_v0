import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for AUTH-requiring specs.
 * Run via: scripts/gate-auth-e2e.sh
 * Uses real auth (CSRF → callback → session), no stubs.
 */
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3002';

export default defineConfig({
  testDir: './e2e/auth',
  testMatch: [
    // Incremental: only specs explicitly promoted to the auth gate
    'rbac.dashboards.contract.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: 'line',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          chromiumSandbox: false,
        },
      },
    },
  ],
});
