/**
 * Tests de fumée de PRODUCTION de l'espace pédagogique. Écrit uniquement avec les comptes techniques de
 * validation ; les vrais élèves ne sont jamais utilisés que pour vérifier leur connexion (lecture seule).
 *
 *   ESPACE_PROD_URL=https://… ESPACE_VALIDATION_CREDENTIALS=/chemin/0600 ESPACE_REAL_CREDENTIALS=/chemin/0600 \
 *   npx playwright test -c playwright.prod-smoke.config.ts
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/prod',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: [['list']],
  use: { baseURL: process.env.ESPACE_PROD_URL ?? 'https://nexusreussite.academy', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
