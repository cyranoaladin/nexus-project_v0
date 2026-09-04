import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration - Chromium Desktop focus
 */
const baseURL =
  process.env.BASE_URL ??
  process.env.PLAYWRIGHT_TEST_BASE_URL ??
  'http://127.0.0.1:3002';

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public';
const previewUsername = process.env.PLAYWRIGHT_HTTP_USERNAME;
const previewPassword = process.env.PLAYWRIGHT_HTTP_PASSWORD;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.spec.ts'],
  // `e2e/aria/*` est reserve aux voies dediees de `playwright.aria.config.ts`
  // (desktop 1366x768, mobile 390x844, a11y 1440x900, smoke), avec leurs viewports,
  // credentials et greps dedies (@visual, @a11y).
  // La voie generique Playwright exclut explicitement ARIA pour eviter les collisions.
  testIgnore: ['**/auth/**', '**/real/**', '**/npc/**', '**/aria/**'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  timeout: process.env.CI ? 60_000 : 90_000,
  globalTimeout: process.env.PLAYWRIGHT_GLOBAL_TIMEOUT_MS
    ? Number(process.env.PLAYWRIGHT_GLOBAL_TIMEOUT_MS)
    : 0,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...(previewUsername && previewPassword
      ? { httpCredentials: { username: previewUsername, password: previewPassword } }
      : {}),
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
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'node .next/standalone/server.js',
          env: {
            HOSTNAME: '127.0.0.1',
            PORT: '3002',
            NEXTAUTH_URL: 'http://127.0.0.1:3002',
            DATABASE_URL: e2eDatabaseUrl,
            TEST_DATABASE_URL: e2eDatabaseUrl,
          },
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
