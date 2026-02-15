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
  projects: (() => {
    const skipChromium = process.env.SKIP_CHROMIUM === '1';
    const setupProject = skipChromium
      ? {
          name: 'setup',
          testMatch: /.*\.setup\.ts/,
          use: { ...devices['Desktop Firefox'] },
        }
      : {
          name: 'setup',
          testMatch: /.*\.setup\.ts/,
          use: {
            ...devices['Desktop Chrome'],
            launchOptions: {
              args: ['--no-sandbox', '--disable-setuid-sandbox'],
              chromiumSandbox: false,
            },
          },
        };

    if (skipChromium) {
      return [
        setupProject,
        { name: 'firefox', use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
        { name: 'webkit', use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },
      ];
    }

    return [
      setupProject,
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
          launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            chromiumSandbox: false,
          },
        },
        dependencies: ['setup'],
      },
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
        dependencies: ['setup'],
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
        dependencies: ['setup'],
      },
    ];
  })(),
  // webServer disabled - run dev server manually before running tests
  // webServer: {
  //   command: 'npm run dev',
  //   url: baseURL,
  //   reuseExistingServer: true,
  // },
});
