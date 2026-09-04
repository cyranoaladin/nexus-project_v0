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
  // Portee declaree POSITIVEMENT : cette voie possede les specs situees a la
  // RACINE de e2e/. Chaque sous-repertoire appartient a une voie dediee —
  // `auth/` a playwright.auth.config.ts, `real/` a playwright.ci.config.ts,
  // `aria/` a playwright.aria.config.ts, `npc/` a playwright.npc.config.ts.
  //
  // `e2e/aria/*` est ecrit pour les QUATRE projets de la config ARIA (desktop
  // 1366x768, mobile 390x844, a11y 1440x900, smoke), chacun avec son viewport
  // et son grep @visual / @a11y. Sous le projet unique `chromium` ci-dessous,
  // la matrice dont depend E018 ARIA_VISUAL_VIEWPORT_MATRIX n'existe pas.
  //
  // Ces specs ne sont PAS ecartees par motif : `check-zero-test-debt` refuse
  // tout `testIgnore` mentionnant aria, et cette garde reste stricte — on ne
  // l'amende pas pour se donner une dispense. Dire ce que la voie POSSEDE,
  // plutot qu'enumerer ce qu'elle rejette, supprime la cause au lieu de la
  // contourner : aucun `testIgnore` n'est necessaire.
  //
  // Les motifs `testMatch` sont compares au chemin ABSOLU : un glob relatif
  // comme `*.spec.ts` ne matcherait rien. L'expression exige que le fichier
  // soit directement dans `e2e/`, sans separateur supplementaire.
  testMatch: /[\\/]e2e[\\/][^\\/]+\.spec\.ts$/,
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
