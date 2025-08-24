import { defineConfig, devices } from '@playwright/test';

// Forcer l'exécution des specs E2E par défaut
process.env.E2E_RUN = process.env.E2E_RUN || '1';

const E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  reporter: 'line',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  webServer: {
    command: 'PORT=3001 NEXTAUTH_URL=http://localhost:3001 NEXT_PUBLIC_E2E=1 E2E=1 E2E_RUN=1 npm run dev',
    url: 'http://localhost:3001/auth/signin',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      workers: 1,
      retries: 2,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      retries: 0,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      retries: 1,
    },
  ],
});
