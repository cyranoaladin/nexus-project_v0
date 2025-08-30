import { defineConfig, devices } from '@playwright/test';

// Forcer l'exécution des specs E2E par défaut
process.env.E2E_RUN = process.env.E2E_RUN || '1';
// Forcer le mode standalone par défaut (peut être désactivé en exportant E2E_STANDALONE=0)
process.env.E2E_STANDALONE = process.env.E2E_STANDALONE ?? '1';

const E2E_PORT = process.env.E2E_PORT || '3100';
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  reporter: 'line',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  globalSetup: 'e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/student.json' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], storageState: 'e2e/.auth/student.json' } },
    { name: 'webkit', use: { ...devices['Desktop WebKit'], storageState: 'e2e/.auth/student.json' } },
  ],
  ...(process.env.CI
    ? {
        webServer: {
          command: `npm run build && PORT=${E2E_PORT} npm run start`,
          url: E2E_BASE_URL,
          reuseExistingServer: false,
          timeout: 2 * 60 * 1000,
        },
      }
    : {}),
});
