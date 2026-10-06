import { defineConfig, devices } from '@playwright/test';

/**
 * Plan de secours hors ligne (`scripts/espace/build-fallback.ts`).
 * Aucune base de données, aucun serveur d'application : le spec construit le paquet, le sert avec
 * `python3 -m http.server` et bloque toute requête hors localhost.
 *
 *   npx playwright test -c playwright.fallback.config.ts
 */
export default defineConfig({
  testDir: './e2e/fallback',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  outputDir: 'test-results/fallback',
  // Construction du paquet (esbuild, KaTeX) + premier chargement de Pyodide : marge large.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--no-sandbox', '--disable-setuid-sandbox'], chromiumSandbox: false },
      },
    },
  ],
});
