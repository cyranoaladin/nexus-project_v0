import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAsUser } from '../helpers/auth';

/**
 * Committed, replayable accessibility + keyboard suite for the
 * candidat-individuel wizard preview and assistante workspace (mission
 * "vers un produit complet" §2/§3/§6). Runs against the real production
 * build via the disposable e2e stack (docker-compose.e2e.yml / npm run
 * test:e2e:ephemeral), never a throwaway local script.
 *
 * Step-count reconciliation (mission §2): the wizard has 17 canonical
 * steps (STEPS array, components/dashboard/assistante/PublicWizardPreview.tsx).
 * e940fc931 announced 16 — `etalement` was added one commit later
 * (afea675ff, closing a real gap: P12 was never collected). This suite
 * visits and axe-checks every one of the 17 steps individually — the
 * matrix below is reproducible, not a historical snapshot, and no step is
 * grouped by "equivalence" the way the earlier throwaway verification did.
 *
 * Flag activation: scripts/seed-e2e-db.ts writes
 * pricing.candidatIndividuelPipeline.state=ACTIVE_INTERNAL to the
 * disposable e2e DB, but a real Next.js server only loads its in-process
 * BusinessConfig snapshot ONCE at boot (instrumentation.ts) — confirmed
 * empirically here (a first full run against the freshly-seeded stack
 * showed every wizard-preview request rendering "Nouveau moteur non
 * activé", proven via a captured page snapshot). The sanctioned way to
 * change it on an ALREADY-RUNNING server (this session's own earlier
 * finding, mission "vers un produit complet" §2) is the real PATCH
 * /api/admin/config endpoint, whose handler calls applyWrite() to update
 * the in-process snapshot directly — so this suite activates it for real,
 * the same way, instead of trusting the seed alone.
 */
async function activateCandidatIndividuelFlag(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsUser(page, 'admin', { navigate: false });
  const res = await page.request.patch('/api/admin/config', {
    data: { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL' },
  });
  if (res.status() !== 200) {
    throw new Error(`Flag activation PATCH failed: ${res.status()} ${await res.text().catch(() => '')}`);
  }
  await context.close();
}

test.beforeAll(async ({ browser }) => {
  await activateCandidatIndividuelFlag(browser);
});

const STEPS_IN_ORDER = [
  'statut', 'anterieur', 'p3', 'etalement', 'cycle', 'modalite', 'specialites',
  'specialite_abandonnee', 'options', 'langues', 'resultats_anterieurs', 'bascule',
  'diagnostic', 'budget', 'carte', 'scenarios', 'coordonnees',
] as const;

function activeInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const label = el.closest ? el.closest('label') : null;
    const text = (el.textContent || (label ? label.textContent : '') || '').trim().slice(0, 60);
    return { tag: el.tagName, text, type: el.getAttribute('type'), role: el.getAttribute('role') };
  });
}

async function runAxeAllSeverities(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length > 0) {
    const byLevel: Record<string, number> = {};
    for (const v of results.violations) byLevel[v.impact ?? 'unknown'] = (byLevel[v.impact ?? 'unknown'] ?? 0) + v.nodes.length;
    console.log(`[a11y] ${label}: ${JSON.stringify(byLevel)}`);
    for (const v of results.violations) {
      for (const node of v.nodes) console.log(`  [${v.impact}] ${v.id}: ${node.target} — ${node.html.slice(0, 100)}`);
    }
  }
  // Zero violations at EVERY severity level, not a critical/serious-only
  // filter — mission §2 explicit requirement.
  expect(results.violations, `${label}: axe violations (all severities)`).toEqual([]);
}

/** Advances from `statut` to the target step, filling only what canGoNext() actually requires (mission §2 matrix: statut/specialites/modalite/budget gate; every other step is unconditionally advanceable). Terminale + MATHEMATIQUES/PHYSIQUE_CHIMIE + modalité A — exercises the specialites/modalite gates and every step, at the cost of never reaching the PREMIERE-only "cycle" active branch (checked separately below). */
async function advanceThroughWizard(page: Page, targetStep: (typeof STEPS_IN_ORDER)[number]) {
  const targetIndex = STEPS_IN_ORDER.indexOf(targetStep);
  await page.locator('label:has-text("Terminale")').first().click();

  for (let currentIndex = 0; currentIndex < targetIndex; currentIndex += 1) {
    const current = STEPS_IN_ORDER[currentIndex];
    if (current === 'modalite') {
      await page.getByRole('button', { name: 'Choisir A' }).click();
    }
    if (current === 'specialites') {
      await page.getByLabel('Première spécialité').selectOption('MATHEMATIQUES');
      await page.getByLabel('Deuxième spécialité').selectOption('PHYSIQUE_CHIMIE');
    }
    if (current === 'budget') {
      await page.getByLabel('Budget mensuel, saisie libre').fill('2000');
      await page.getByRole('button', { name: 'Voir ma carte et mon estimation' }).click();
      await page.waitForTimeout(1500);
      continue;
    }
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForTimeout(150);
  }
}

for (const viewport of [{ name: 'desktop', width: 1280, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test.describe(`Candidat-individuel wizard — axe per step (${viewport.name})`, () => {
    // reducedMotion: 'reduce' is already set globally in playwright.config.e2e.ts's `use` block.
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const step of STEPS_IN_ORDER) {
      test(`step "${step}" — 0 axe violations at any severity`, async ({ page }) => {
        await loginAsUser(page, 'assistante');
        await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
        await advanceThroughWizard(page, step);
        await runAxeAllSeverities(page, `wizard step "${step}" (${viewport.name})`);
      });
    }

    test('assistante workspace principal — 0 axe violations at any severity', async ({ page }) => {
      await loginAsUser(page, 'assistante');
      await page.goto('/dashboard/assistante/candidat-individuel', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await runAxeAllSeverities(page, `assistante workspace (${viewport.name})`);
    });

    test('step "cycle" — PREMIERE branch (the main walk above only exercises the TERMINALE "non applicable" branch) — 0 axe violations', async ({ page }) => {
      await loginAsUser(page, 'assistante');
      await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await page.locator('label:has-text("Première")').first().click();
      // statut -> anterieur -> p3 -> etalement -> cycle (4 Continuer clicks)
      for (let i = 0; i < 4; i += 1) {
        await page.getByRole('button', { name: 'Continuer' }).click();
        await page.waitForTimeout(150);
      }
      await expect(page.getByText(/cycle complet/i).first()).toBeVisible();
      await runAxeAllSeverities(page, `wizard step "cycle" — PREMIERE branch (${viewport.name})`);
    });
  });
}

test.describe('Candidat-individuel wizard — keyboard-only navigation (committed, replayable)', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('skip link moves real DOM focus past the sidebar into <main>', async ({ page }) => {
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.keyboard.press('Tab');
    const first = await activeInfo(page);
    expect(first?.text).toContain('Aller au contenu principal');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const afterSkip = await activeInfo(page);
    expect(afterSkip?.tag).toBe('MAIN');
  });

  test('radio groups are selected via native semantics (Tab into group, ArrowDown to move+select), not by Tab-cycling siblings', async ({ page }) => {
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Enter'); // -> main
    await page.keyboard.press('Tab'); // -> "Première" (first unchecked radio in "level")
    const landed = await activeInfo(page);
    expect(landed?.text).toContain('Première');
    await page.keyboard.press('ArrowDown');
    const afterArrow = await activeInfo(page);
    expect(afterArrow?.text).toContain('Terminale');
    const checked = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.checked);
    expect(checked).toBe(true);
  });

  test('focus is not lost (never falls back to <body>) after a step transition', async ({ page }) => {
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.locator('label:has-text("Terminale")').first().click();
    await page.getByRole('button', { name: 'Continuer' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const bodyFocused = await page.evaluate(() => document.activeElement === document.body);
    expect(bodyFocused).toBe(false);
  });

  test('the step counter is announced via aria-live so a screen-reader user hears step transitions without a repeated full-page announcement', async ({ page }) => {
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const liveRegions = await page.locator('[aria-live]').count();
    expect(liveRegions).toBeGreaterThan(0);
    const stepCounter = page.locator('[aria-live="polite"]', { hasText: /Étape \d+ sur \d+/ });
    await expect(stepCounter).toBeVisible();
    await expect(stepCounter).toContainText('Étape 1 sur 17');
  });

  test('the back button is reachable and focusable via keyboard', async ({ page }) => {
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    // The back button is correctly disabled (unfocusable, by HTML spec) on
    // the very first step (stepIndex===0, nothing to go back to) — advance
    // one step first so this test exercises the button in its enabled state.
    await page.locator('label:has-text("Terminale")').first().click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForTimeout(150);
    const backButton = page.getByRole('button', { name: /retour|précédent/i });
    await expect(backButton).toHaveCount(1);
    await expect(backButton).toBeEnabled();
    await backButton.focus();
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('BUTTON');
  });
});

test.describe('Candidat-individuel wizard — narrow viewport and zoom (mission "vers un produit complet" §7)', () => {
  test('320px width: no horizontal overflow on the entry step', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `document.documentElement.scrollWidth (${scrollWidth}) must not exceed clientWidth (${clientWidth}) at 320px — horizontal overflow`).toBeLessThanOrEqual(clientWidth + 1);
    await runAxeAllSeverities(page, 'wizard step "statut" (320px)');
  });

  test('200% browser zoom: no horizontal overflow and the level radios stay usable', async ({ page }) => {
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/assistante/candidat-individuel/wizard-preview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    // Playwright has no native "browser zoom" control — the standard proxy
    // is halving the effective viewport (CSS pixels), which produces the
    // same layout the browser's own 200% zoom would (twice as much content
    // per physical pixel is irrelevant to CSS layout; only the CSS
    // viewport size drives reflow).
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: Math.round((viewport?.width ?? 1280) / 2), height: Math.round((viewport?.height ?? 1000) / 2) });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `horizontal overflow at simulated 200% zoom (scrollWidth=${scrollWidth}, clientWidth=${clientWidth})`).toBeLessThanOrEqual(clientWidth + 1);
    await expect(page.locator('label:has-text("Terminale")').first()).toBeVisible();
  });
});
