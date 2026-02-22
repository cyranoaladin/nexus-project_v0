import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration - Chromium Desktop focus
 */
const baseURL = process.env.CI
  ? (process.env.NEXTAUTH_URL ?? 'http://localhost:3000')
  : 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: process.env.CI ? 60_000 : 90_000,
  globalTimeout: process.env.CI ? 11 * 60_000 : 0, // 11 min in CI (1 min below step timeout for graceful report), unlimited locally
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
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'HOSTNAME=127.0.0.1 PORT=3000 NEXTAUTH_URL=http://localhost:3000 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public SKIP_MIDDLEWARE=true SKIP_APP_AUTH=true npm run dev',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
