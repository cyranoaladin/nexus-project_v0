import { defineConfig, devices } from '@playwright/test';

const E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';
const USE_EXTERNAL_SERVER = !!process.env.E2E_NO_SERVER || (process.env.E2E_BASE_URL && process.env.E2E_BASE_URL !== 'http://localhost:3001');
const IS_CI = !!process.env.CI;

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
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: E2E_BASE_URL,

    /* Prefer consistent test id selectors */
    testIdAttribute: 'data-testid',

    /* Enrich CI artifacts */
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  timeout: 60 * 1000, // Augmenter le timeout global à 60 secondes

  /* Configure projects for major browsers (Chromium-only on CI to reduce flakiness) */
  projects: IS_CI
    ? [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ]
    : [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ],

  /* Run your local dev server before starting the tests (disabled if using external server) */
  webServer: USE_EXTERNAL_SERVER
    ? undefined
    : {
      command:
        // Load optional .env.e2e if present; fallback to inline safe defaults
        "dotenv -e .env.e2e -- bash -lc '" +
        // E2E flags and URLs
        'export E2E=1 NEXT_PUBLIC_E2E=1 NEXTAUTH_URL=' + E2E_BASE_URL + ' NEXT_TELEMETRY_DISABLED=1; ' +
        // Fallback DB URL if not provided from environment/CI service
        'if [ -z \"$DATABASE_URL\" ]; then export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nexus_dev?schema=public; fi; ' +
        // Ensure NEXTAUTH_SECRET exists without hardcoding if .env.e2e not provided
        'if [ -z \"$NEXTAUTH_SECRET\" ]; then export NEXTAUTH_SECRET=e2e-test-secret; fi; ' +
        // Ensure schema exists in E2E regardless of migrations folder presence
        'npm run db:push; ' +
        'npm run db:seed; ' +
        // Clean Next artifacts to avoid partial manifests on dev startup
        'rm -rf .next; ' +
        'npm run dev -- --port 3001' +
        "'",
      url: E2E_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300 * 1000, // Augmentation du timeout à 5 minutes
    },
});
