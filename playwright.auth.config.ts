import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for AUTH-requiring specs.
 * Run via: scripts/gate-auth-e2e.sh
 * Uses real auth (CSRF → callback → session), no stubs.
 */
const baseURL = process.env.BASE_URL ?? 'http://localhost:3002';

export default defineConfig({
  testDir: './e2e/auth',
  // Liste EXHAUSTIVE et intentionnelle des specs de cette voie.
  //
  // Elle etait auparavant incrementale — « only specs explicitly promoted » —
  // et 61 des 80 specs presentes n'y figuraient pas : elles existaient sans
  // jamais s'executer, donnant l'apparence d'une couverture. Chaque spec du
  // repertoire y figure desormais, groupee par domaine pour rester lisible.
  // `scripts/testing/e2e-ownership.mjs` echoue si un fichier de e2e/auth en
  // est absent : la liste ne peut plus diverger du repertoire en silence.
  testMatch: [
    // ── Acces, sessions et separation des roles
    'api-health.spec.ts',
    'auth-role-separation.spec.ts',
    'auth.workflows.spec.ts',
    'password-reset.spec.ts',
    'qa-auth-workflows.spec.ts',
    'rbac.dashboards.contract.spec.ts',
    'redirections.contract.spec.ts',
    'security.advanced.spec.ts',
    'session-revocation.spec.ts',
    'signin-form.spec.ts',
    'test-real-login.spec.ts',

    // ── Parcours Parent
    'parcours-parent-multi-enfants.spec.ts',
    'parent-canonical-report-access.spec.ts',
    'parent-dashboard-audit.spec.ts',
    'parent-dashboard.spec.ts',
    'parent-email-onboarding.spec.ts',
    'parent-subscription-sale-closed.spec.ts',
    'pending-parent-lifecycle.spec.ts',

    // ── Parcours Eleve
    'dashboard-eleve-eds-premiere.spec.ts',
    'dashboard-eleve-stmg-premiere.spec.ts',
    'eam-premiere-responsive-readonly.spec.ts',
    'eam-premiere-student.spec.ts',
    'eleve-dashboard-audit.spec.ts',
    'initial-student-activation.spec.ts',
    'nsi-pratique-2026.spec.ts',
    'parcours-eleve-eds-premiere.spec.ts',
    'parcours-eleve-stmg-premiere.spec.ts',
    'parcours-eleve-stmg-survival.spec.ts',
    'student-automatismes.spec.ts',
    'student-dashboard.spec.ts',
    'student-journey.spec.ts',

    // ── Parcours Coach et Assistante
    'admin-dashboard-audit.spec.ts',
    'assistante-subscription-approval-invariants.spec.ts',
    'coach-dashboard-audit.spec.ts',
    'coach-maths-premiere-report.spec.ts',
    'coach-stage-bilans.spec.ts',
    'parcours-coach-cohorte.spec.ts',
    'dashboard-pages-health.spec.ts',
    'test-dashboard-interactions.spec.ts',

    // ── Bilans et restitutions
    'bilan-golden-path.spec.ts',
    'bilan-gratuit-flow.spec.ts',
    'bilan-pdf.e2e.spec.ts',
    'bilan-worker-autonomous.spec.ts',
    'canonical-attempt-level-guard.spec.ts',
    'diagnostic-flows.spec.ts',
    'eaf-report-raja-smoke.spec.ts',
    'teacher-bilan-pdf.spec.ts',
    'test-bilan-banner.spec.ts',

    // ── Reservation, droits d'acces et paiements
    'auth-and-booking.spec.ts',
    'booking.credits.spec.ts',
    'entitlements.gating.spec.ts',
    'payments.invoice.documents.spec.ts',

    // ── NPC — surface navigateur
    'npc-coach-workflow.spec.ts',
    'npc-rbac.spec.ts',
    'npc-student-view.spec.ts',

    // ── Programme Maths Premiere
    'programme/maths-1ere-access.spec.ts',
    'programme/maths-1ere-premium.spec.ts',
    'programme/maths-1ere.spec.ts',

    // ── Planning Studio
    'planning-studio-access.spec.ts',
    'planning-studio-policy.spec.ts',
    'planning-studio-responsive.spec.ts',
    'planning-studio-shared.spec.ts',
    'planning-studio-smoke.spec.ts',
    'planning-studio-ui-contract.spec.ts',

    // ── Surfaces publiques et accessibilite
    'accessibility-basics.spec.ts',
    'accessibility-dashboards.spec.ts',
    'axe-dashboards.spec.ts',
    'dialog-all-roles-proof.spec.ts',
    'dialog-charte-proof.spec.ts',
    'forms-validation.contract.spec.ts',
    'marketing-navigation.spec.ts',
    'mobile-responsiveness.spec.ts',
    'navigation-public.contract.spec.ts',
    'nexus-premium-final.spec.ts',
    'offres-quiz.spec.ts',
    'pages-public-homepage-mobile.spec.ts',
    'price-render-check.spec.ts',
    'public-front-go-live.spec.ts',
    'public-pages-health.spec.ts',
    'responsive-layout.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'line',
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
    // Smoke multi-navigateurs : le parcours essentiel du Planning Studio doit
    // se comporter de la meme facon hors Chromium. Restreint a une spec pour
    // rester rapide, mais reellement execute — une difference de comportement
    // Firefox ou WebKit se corrige, elle ne se declare pas en dette.
    {
      name: 'firefox-smoke',
      testMatch: ['planning-studio-smoke.spec.ts'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-smoke',
      testMatch: ['planning-studio-smoke.spec.ts'],
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
