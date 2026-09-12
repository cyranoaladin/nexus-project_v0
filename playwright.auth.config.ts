import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for AUTH-requiring specs.
 * Run via: scripts/gate-auth-e2e.sh
 * Uses real auth (CSRF → callback → session), no stubs.
 */
const baseURL = process.env.BASE_URL ?? 'http://localhost:3002';
const reportLabel = process.env.AUTH_E2E_REPORT_LABEL ?? 'auth-local';
if (!/^[a-z0-9-]+$/.test(reportLabel)) throw new Error('INVALID_AUTH_E2E_REPORT_LABEL');

export default defineConfig({
  testDir: './e2e/auth',
  // Ownership is directory-based, not a manual filename list (PR #235):
  // every *.spec.ts under e2e/auth/** (including subdirectories, e.g.
  // e2e/auth/npc/) is collected. A spec that needs real authentication
  // belongs under e2e/auth/ — that placement alone is its CI-lane
  // membership. No exclusions currently apply.
  testMatch: ['**/*.spec.ts'],
  testIgnore: [],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // Machine-readable execution proof (PR #235 follow-up): 'line' alone gives
  // console usability but writes no durable artifact, so CI's
  // playwright-auth-report upload silently found nothing to upload. json +
  // junit give a deterministic, parseable, per-spec/per-test/per-project
  // result (pass/fail/skipped) that the e2e-ownership execution audit can
  // consume directly instead of parsing raw job logs.
  reporter: [
    ['line'],
    ['json', { outputFile: `playwright-report/${reportLabel}/results.json` }],
    ['junit', { outputFile: `playwright-report/${reportLabel}/junit.xml` }],
  ],
  outputDir: `test-results/${reportLabel}`,
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
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
    // Smoke multi-navigateurs : le parcours essentiel du Planning Studio (et,
    // depuis la Tâche 17, le scénario capstone famille dorée) doit se
    // comporter de la meme facon hors Chromium. Restreint a quelques specs
    // pour rester rapide, mais reellement execute — une difference de
    // comportement Firefox ou WebKit se corrige, elle ne se declare pas en
    // dette.
    {
      name: 'firefox-smoke',
      testMatch: ['planning-studio-smoke.spec.ts', 'core-golden-family.spec.ts', 'auth-client-lifecycle.spec.ts'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-smoke',
      testMatch: ['planning-studio-smoke.spec.ts', 'core-golden-family.spec.ts', 'auth-client-lifecycle.spec.ts'],
      use: { ...devices['Desktop Safari'] },
    },
    // Tâche 17 : le scénario famille dorée doit aussi tenir sur un viewport
    // mobile réel (pas seulement une largeur réduite) — device profile
    // complet (UA, taille, touch) plutôt qu'une resize ad hoc.
    {
      name: 'mobile-smoke',
      testMatch: ['core-golden-family.spec.ts', 'auth-client-lifecycle.spec.ts'],
      use: { ...devices['Pixel 7'] },
    },
  ],
});
