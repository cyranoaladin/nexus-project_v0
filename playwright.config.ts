import { defineConfig, devices } from '@playwright/test';

const E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3003';
const USE_EXTERNAL_SERVER = !!process.env.E2E_NO_SERVER || (process.env.E2E_BASE_URL && process.env.E2E_BASE_URL !== 'http://localhost:3003');
const IS_CI = !!process.env.CI;
const USE_NO_SERVER = process.env.E2E_NO_SERVER === '1';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [ ['junit', { outputFile: 'junit-e2e.xml' }], ['html'] ] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: E2E_BASE_URL,

    /* Prefer consistent test id selectors */
    testIdAttribute: 'data-testid',

    /* Enrich CI artifacts */
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  timeout: 30 * 1000, // Augmenter le timeout global à 60 secondes
  expect: { timeout: 5000 },

  /* Configure projects for major browsers (Chromium-only on CI to reduce flakiness) */
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  /* Run your local dev server before starting the tests */
  webServer: USE_NO_SERVER ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      E2E: '1',
      NEXT_PUBLIC_E2E: '1',
      PLAYWRIGHT: '1',
      NODE_ENV: 'development',
      NEXTAUTH_URL: 'http://localhost:3003',
      E2E_BASE_URL: 'http://localhost:3003'
    }
  },
});
