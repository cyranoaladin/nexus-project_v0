import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration - Chromium Desktop focus
 */
const baseURL = 'http://127.0.0.1:3001';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['student-journey.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 90_000,
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
  webServer: {
    command: 'HOSTNAME=127.0.0.1 PORT=3001 SKIP_MIDDLEWARE=true SKIP_APP_AUTH=true npm run dev',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
