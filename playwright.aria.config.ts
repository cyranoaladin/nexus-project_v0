import { defineConfig, devices } from '@playwright/test';

const project = process.env.PLAYWRIGHT_PROJECT ?? 'aria-all';
const artifactRoot = `.artifacts/aria/playwright/${project}`;

export default defineConfig({
  testDir: './e2e/aria',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['line'],
    ['junit', { outputFile: `${artifactRoot}/junit.xml` }],
    ['json', { outputFile: `${artifactRoot}/report.json` }],
    ['html', { outputFolder: `${artifactRoot}/html`, open: 'never' }],
  ],
  outputDir: `${artifactRoot}/results`,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://app-e2e:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'aria-desktop',
      testMatch: /conversation\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'aria-mobile',
      testMatch: /visual-a11y\.spec\.ts/,
      grep: /@visual/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'aria-a11y',
      testMatch: /visual-a11y\.spec\.ts/,
      grep: /@a11y/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'aria-smoke',
      testMatch: /production-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
  ],
});
