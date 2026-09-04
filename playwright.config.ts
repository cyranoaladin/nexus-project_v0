import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration - Chromium Desktop focus
 */
const baseURL =
  process.env.BASE_URL ??
  process.env.PLAYWRIGHT_TEST_BASE_URL ??
  'http://127.0.0.1:3002';

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public';
const previewUsername = process.env.PLAYWRIGHT_HTTP_USERNAME;
const previewPassword = process.env.PLAYWRIGHT_HTTP_PASSWORD;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.spec.ts'],
  // `e2e/aria/*` est balaye par cette voie alors qu'il est ecrit pour les
  // QUATRE projets de playwright.aria.config.ts (desktop 1366x768, mobile
  // 390x844, a11y 1440x900, smoke), chacun avec son viewport et son grep
  // @visual / @a11y. Sous le projet unique `chromium` ci-dessous, la matrice de
  // viewports dont E018 ARIA_VISUAL_VIEWPORT_MATRIX depend n'existe pas : ces
  // specs ne peuvent pas y passer.
  //
  // Elles ne sont PAS ajoutees a `testIgnore` : `scripts/testing/check-zero-test-debt.mjs`
  // refuse tout motif d'exclusion mentionnant aria, et cette garde est
  // deliberee — elle empeche de faire taire une qualification ARIA. Leur voie
  // proprietaire est playwright.aria.config.ts, dont la meme garde tire sa
  // collecte de reference, et le job CI `aria-browser` en execute les quatre
  // lanes. Cette configuration n'est joue par aucun workflow.
  testIgnore: ['**/auth/**', '**/real/**', '**/npc/**'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  timeout: process.env.CI ? 60_000 : 90_000,
  globalTimeout: process.env.PLAYWRIGHT_GLOBAL_TIMEOUT_MS
    ? Number(process.env.PLAYWRIGHT_GLOBAL_TIMEOUT_MS)
    : 0,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...(previewUsername && previewPassword
      ? { httpCredentials: { username: previewUsername, password: previewPassword } }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          chromiumSandbox: false,
        },
      },
    },
  ],
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'node .next/standalone/server.js',
          env: {
            HOSTNAME: '127.0.0.1',
            PORT: '3002',
            NEXTAUTH_URL: 'http://127.0.0.1:3002',
            DATABASE_URL: e2eDatabaseUrl,
            TEST_DATABASE_URL: e2eDatabaseUrl,
          },
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
