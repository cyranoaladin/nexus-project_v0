import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  // Démarre automatiquement le serveur standalone pendant les tests
  webServer: {
    command: 'node .next/standalone/server.js',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      PORT: '3001',
      HOSTNAME: '0.0.0.0',
      NODE_ENV: 'production',
      DATABASE_URL: 'file:./prisma/dev.db',
    },
  },
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // Le serveur est lancé automatiquement via webServer ci-dessus
});
