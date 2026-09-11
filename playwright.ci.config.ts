import { defineConfig, devices } from '@playwright/test';

/**
 * CI-specific Playwright Configuration
 *
 * Runs the "real/pages/" test suite plus the "public/" no-auth lane
 * (PR #235: directory-based ownership, not a filename list — any
 * *.spec.ts under either directory is collected automatically).
 */
const baseURL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['real/pages/**/*.spec.ts', 'public/**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
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
