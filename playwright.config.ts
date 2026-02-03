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
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { 
      name: 'chromium', 
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup']
    },
    { 
      name: 'firefox', 
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup']
    },
    { 
      name: 'webkit', 
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup']
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: process.env.REUSE_EXISTING_SERVER === 'true' || !process.env.CI,
  },
});
