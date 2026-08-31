import { chromium, defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3002';
const commonUse = {
  ...devices['Desktop Chrome'],
  baseURL,
  // Candidate searches carry staff-entered PII. This governed lane relies on
  // explicit redacted screenshots in the suite and never auto-captures traces,
  // videos or failure screenshots.
  trace: 'off' as const,
  screenshot: 'off' as const,
  video: 'off' as const,
  actionTimeout: 30_000,
  navigationTimeout: 30_000,
  reducedMotion: 'reduce' as const,
};
const bundledChromium = {
  ...commonUse,
  launchOptions: {
    executablePath: chromium.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    chromiumSandbox: false,
  },
};
const governedChrome = {
  ...commonUse,
  launchOptions: {
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    chromiumSandbox: false,
  },
};

export default defineConfig({
  testDir: './e2e/auth',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 180_000,
  projects: [
    {
      name: 'preflight-bundled-chromium',
      testMatch: 'candidat-individuel-browser-preflight.setup.ts',
      metadata: { expectedBrowserVersion: '145.0.7632.6' },
      use: bundledChromium,
    },
    {
      name: 'preflight-google-chrome-152',
      testMatch: 'candidat-individuel-browser-preflight.setup.ts',
      metadata: { expectedBrowserVersion: '152.0.7977.64' },
      use: governedChrome,
    },
    {
      name: 'candidate-bundled-chromium',
      testMatch: 'candidat-individuel-pipeline.spec.ts',
      dependencies: ['preflight-bundled-chromium'],
      use: bundledChromium,
    },
    {
      name: 'candidate-google-chrome-152',
      testMatch: 'candidat-individuel-pipeline.spec.ts',
      dependencies: ['preflight-google-chrome-152'],
      use: governedChrome,
    },
  ],
} satisfies PlaywrightTestConfig);
