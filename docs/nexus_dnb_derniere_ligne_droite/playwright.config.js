const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  retries: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/e2e/report.json' }],
    ['html', { outputFolder: 'tests/e2e/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.DNB_URL || 'https://nexusreussite.academy/docs_DNB/derniere-ligne-droite/',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'Desktop Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'Tablet Chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
  ],
});
