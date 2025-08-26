import { defineConfig, devices } from '@playwright/test';

// Forcer l'exécution des specs E2E par défaut
process.env.E2E_RUN = process.env.E2E_RUN || '1';

const E2E_PORT = Number(process.env.E2E_PORT || '3000');
const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`;

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
    command: `bash -lc "NEXTAUTH_SECRET=test-e2e-secret NEXT_PUBLIC_E2E=1 E2E=1 E2E_RUN=1 next build && NEXTAUTH_URL=http://localhost:${E2E_PORT} NEXT_PUBLIC_E2E=1 E2E=1 E2E_RUN=1 NEXTAUTH_SECRET=test-e2e-secret npx next start -p ${E2E_PORT}"`,
    url: `http://localhost:${E2E_PORT}/`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  use: {
    baseURL: E2E_BASE_URL,
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
      workers: 1,
      retries: 1,
    },
  ],
});
