import { defineConfig, devices } from '@playwright/test';

// Ensure E2E-mode environment variables for the test runner process itself
process.env.E2E = process.env.E2E || '1';
process.env.NEXT_PUBLIC_E2E = process.env.NEXT_PUBLIC_E2E || '1';
process.env.PLAYWRIGHT = '1';

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
  /* Opt out of parallel tests on CI; reduce local parallelism to 4 for stability */
  workers: process.env.CI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['junit', { outputFile: 'junit-e2e.xml' }], ['html']] : 'html',
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
      E2E: process.env.E2E || '1',
      NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E || '1',
      PLAYWRIGHT: '1',
      NODE_ENV: 'development',
      PORT: '3003',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'testsecretlongenough12345678901234567890',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3003',
      E2E_BASE_URL: process.env.E2E_BASE_URL || 'http://localhost:3003',
      // Ensure all ARIA SSE tests target the running server
      BASE_URL: process.env.BASE_URL || 'http://localhost:3003',
      BASE_URL_TIMEOUT: process.env.BASE_URL_TIMEOUT || process.env.BASE_URL || 'http://localhost:3003',
      BASE_URL_FBOK: process.env.BASE_URL_FBOK || process.env.BASE_URL || 'http://localhost:3003',
      // Route specialisée pour forcer les erreurs SSE "error → done" dans les tests
      BASE_URL_FBFAIL: process.env.BASE_URL_FBFAIL || 'http://localhost:3003/api/fbfail',
      BASE_URL_PROD: process.env.BASE_URL_PROD || process.env.BASE_URL || 'http://localhost:3003'
    }
  },
});
