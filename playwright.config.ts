import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration - Nexus Réussite Platform
 *
 * Port Convention: Always use 3000 for consistency
 * - Local dev: 3000
 * - E2E tests: 3000
 * - CI: 3000
 */
const baseURL = 'http://localhost:3000'; // Fixed port for consistency

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // webServer disabled - run dev server manually before running tests
  // webServer: {
  //   command: 'npm run dev',
  //   url: baseURL,
  //   reuseExistingServer: true,
  // },
});
