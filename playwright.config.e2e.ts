import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Playwright Config — Autonomous Ephemeral
 *
 * Used by: npm run test:e2e:ephemeral (docker-compose.e2e.yml)
 *
 * The app is started by the app-e2e Docker container.
 * No webServer block needed — Playwright just connects to the running app.
 *
 * For local dev (outside Docker):
 *   BASE_URL=http://localhost:3001 npx playwright test --config playwright.config.e2e.ts
 */
const baseURL = process.env.BASE_URL || 'http://app-e2e:3000';

export default defineConfig({
  testDir: '.',
  testMatch: ['__tests__/e2e/**/*.spec.ts', 'e2e/**/*.spec.ts'],
  testIgnore: [
    '.next/**',
    'node_modules/**',
    // External diagnostic lanes require operator-provided browser state or
    // identities. They are documented in e2e/QUARANTINE.md and are not part
    // of the self-contained disposable stack.
    'e2e/candidate-diagnostic.spec.ts',
    'e2e/real/coach-resource-student.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        reducedMotion: 'reduce',
      },
    },
  ],
  // No webServer — app-e2e container handles startup via docker-compose
});
