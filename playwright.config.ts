import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const useProdServer = process.env.PLAYWRIGHT_USE_PROD === '1';
const isPnpm = process.env.npm_execpath?.includes('pnpm');
const webServerCommand = useProdServer
  ? isPnpm
    ? 'pnpm build && pnpm start'
    : 'npm run build && npm run start'
  : isPnpm
    ? 'pnpm dev:web'
    : 'npm run dev';
const includeWebkit = process.env.PLAYWRIGHT_INCLUDE_WEBKIT === '1';

const projects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
];

if (includeWebkit) {
  projects.push({
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  });
}

projects.push({
  name: 'dashboard-rag',
  testDir: './playwright',
  grep: /Dashboard RAG/,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

export default defineConfig({
  /* Default test directory (legacy E2E suite) */
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['html', { open: process.env.PW_TEST_HTML_REPORT_OPEN ?? 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects,
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: useProdServer ? false : !process.env.CI,
    timeout: useProdServer ? 180_000 : 120_000,
  },
});
