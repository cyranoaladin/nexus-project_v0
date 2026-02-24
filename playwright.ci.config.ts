import { defineConfig, devices } from '@playwright/test';

/**
 * CI-specific Playwright Configuration
 *
 * Runs only the core "real/pages/" test suite (~185 tests) for fast,
 * reliable CI feedback. The full suite (606 tests) can be run locally
 * with the default playwright.config.ts.
 */
const baseURL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e/real/pages',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
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
        channel: 'chrome',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          chromiumSandbox: false,
        },
      },
    },
  ],
});
