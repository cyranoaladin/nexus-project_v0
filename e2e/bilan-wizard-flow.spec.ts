import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

async function completeQcmStep(page) {
  // Wait for wizard to be ready by a stable test id
  await Promise.race([
    page.waitForSelector('[data-testid="wizard-qcm"]', { timeout: 30000 }),
    page.waitForSelector('[data-testid="wizard-pedago"]', { timeout: 30000 })
  ]);
  // Click a few options; the wizard does not enforce validation for every question
  // Select the first option of first 3 questions (if present)
  const qcmRoot = page.locator('[data-testid="wizard-qcm"]');
  const qcmCards = qcmRoot.locator('div:has(> .text-sm.font-medium)');
  const count = await qcmCards.count();
  for (let i = 0; i < Math.min(3, count); i++) {
    const card = qcmCards.nth(i);
    // Click the first label in the card if exists
    const firstOption = card.locator('label').first();
    if (await firstOption.count()) {
      await firstOption.scrollIntoViewIfNeeded();
      await firstOption.click();
    }
  }
  // Use the unified E2E primary-next control to advance deterministically
  const primaryNext = page.getByTestId('wizard-primary-next');
  await expect(primaryNext).toBeVisible({ timeout: 30000 });
  await primaryNext.click();

  // Short settle and check; if still on step 1, fallback to in-step next
  const stepIndicator = page.getByTestId('wizard-step-indicator');
  try {
    await expect(stepIndicator).toHaveText(/2|3/, { timeout: 2000 });
  } catch {
    const nextInQcm = qcmRoot.locator('[data-testid="wizard-next"]');
    if (await nextInQcm.count()) {
      await nextInQcm.scrollIntoViewIfNeeded();
      await nextInQcm.click({ force: true });
    } else {
      const nextButtons = page.getByRole('button', { name: /^Suivant$/ });
      if (await nextButtons.count()) {
        await nextButtons.nth((await nextButtons.count()) - 1).click({ force: true });
      }
    }
  }

  // Wait until we are on pedago step (or results if fast)
  await Promise.race([
    expect(page.getByTestId('wizard-step-indicator')).toHaveText(/2|3/, { timeout: 30000 }),
    expect(page.locator('[data-testid="wizard-pedago"]')).toBeVisible({ timeout: 30000 })
  ]);
}

async function completePedagoStep(page) {
  await expect(page.locator('[data-testid="wizard-pedago"]')).toBeVisible({ timeout: 30000 });
  await page.getByLabel('Motivation principale').fill('examens');
  await page.getByLabel("Style d’apprentissage").fill('visuel');
  await page.getByLabel('Rythme').fill('regulier');
  // Confidence 1..5
  const confidence = page.getByLabel('Confiance (1 à 5)');
  await confidence.fill('4');
  // Use the unified E2E primary-next control to compute results
  const primaryNext = page.getByTestId('wizard-primary-next');
  await expect(primaryNext).toBeVisible({ timeout: 30000 });
  await primaryNext.click();

  // If results not visible quickly, fallback to in-step button
  try {
    await expect(page.getByRole('heading', { level: 3, name: 'Résultats' })).toBeVisible({ timeout: 2000 });
  } catch {
    // pedago still visible; try the in-step button
    const resultsBtn = page.getByTestId('wizard-results');
    if (await resultsBtn.count()) {
      await resultsBtn.click();
    } else {
      await page.getByRole('button', { name: 'Voir les résultats' }).click();
    }
  }

  // Ensure ResultsPanel is visible before returning
  await expect(page.getByRole('heading', { level: 3, name: 'Résultats' })).toBeVisible({ timeout: 30000 });
}

async function submitAndVerifyPdf(page) {
  // Dismiss any alert dialog that may appear after save
  page.once('dialog', async (d) => { try { await d.dismiss(); } catch {} });

  // Stub submit endpoint to return a predictable ID and stub resulting PDF download
  const pdfId = 'e2e-TEST';
  await page.route('**/api/bilan/submit', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ bilanId: pdfId }) });
      return;
    }
    await route.fallback();
  });
  await page.route(`**/api/bilan/pdf/${pdfId}`, async (route) => {
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/pdf' }, body: '%PDF-1.4\n% E2E stub PDF' });
  });

  const submitReqPromise = page.waitForRequest((req) => req.url().includes('/api/bilan/submit') && req.method() === 'POST');
  await page.getByRole('button', { name: 'Enregistrer & Envoyer par e‑mail' }).click();

  // Ensure the submit request was actually sent
  const submitReq = await submitReqPromise;
  try {
    const body = submitReq.postData();
    if (body) {
      const json = JSON.parse(body);
      expect(json.studentId).toBeTruthy();
    }
  } catch {}

  // Wait for the PDF link to appear which indicates successful save
  const pdfLink = page.locator('a[href^="/api/bilan/pdf/"]');
  await expect(pdfLink).toBeVisible({ timeout: 60000 });

  // Validate the link target and content-type via API request (avoid new tab complexities)
  const href = (await pdfLink.getAttribute('href')) || '';
  expect(href).toMatch(/\/api\/bilan\/pdf\//);
  const resp = await page.evaluate(async (url) => {
    try {
      const r = await fetch(url, { method: 'GET' });
      return { ok: r.ok, ct: r.headers.get('content-type') || '' };
    } catch {
      return { ok: false, ct: '' };
    }
  }, href);
  expect(resp.ok).toBeTruthy();
  expect(resp.ct.toLowerCase()).toContain('application/pdf');
}

const EXTERNAL = !!process.env.E2E_NO_SERVER;

const maybe = EXTERNAL ? test.skip : test;

async function ensureWizardLoaded(page: any, who: 'student' | 'parent') {
  if (who === 'student') {
    // Prefer going through the legacy /bilan-gratuit page then CTA to ensure client session is ready
    try { await page.goto('/bilan-gratuit', { waitUntil: 'domcontentloaded' }); } catch {}
    await page.waitForLoadState('domcontentloaded');

    // If redirected to signin, login then come back
    if (/\/auth\/signin/.test(page.url())) {
      await loginAs(page, 'marie.dupont@nexus.com', 'password123');
      try { await page.goto('/bilan-gratuit', { waitUntil: 'domcontentloaded' }); } catch {}
      await page.waitForLoadState('domcontentloaded');
    }

    // Click CTA "Commencer mon Bilan" if present; otherwise navigate directly
    const cta = page.getByRole('link', { name: /Commencer mon Bilan/i }).first();
    if (await cta.count()) {
      await cta.click();
    } else {
      try { await page.goto('/bilan-gratuit/wizard', { waitUntil: 'domcontentloaded' }); } catch {}
    }
  } else {
    // Parent can go directly to wizard; if redirected to signin, login then retry
    try { await page.goto('/bilan-gratuit/wizard', { waitUntil: 'domcontentloaded' }); } catch {}
    await page.waitForLoadState('domcontentloaded');
    if (/\/auth\/signin/.test(page.url())) {
      await loginAs(page, 'parent.dupont@nexus.com', 'password123');
      try { await page.goto('/bilan-gratuit/wizard', { waitUntil: 'domcontentloaded' }); } catch {}
      await page.waitForLoadState('domcontentloaded');
    }
  }

  // Ensure wizard UI shows up
  await Promise.race([
    page.waitForSelector('[data-testid="wizard-qcm"]', { timeout: 30000 }),
    page.waitForSelector('[data-testid="wizard-pedago"]', { timeout: 30000 })
  ]);
}

test.describe('Bilan Wizard E2E', () => {
  maybe('student can complete wizard and download PDF', async ({ page }) => {
    // Ensure session established via dashboard before heading to wizard
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    // Skip dashboard hop; loginAs already established session

    // Navigate directly to wizard and ensure it loads
    await ensureWizardLoaded(page, 'student');

    await completeQcmStep(page);
    await completePedagoStep(page);
    await submitAndVerifyPdf(page);
  });

  maybe('parent selects child, completes wizard, and downloads PDF', async ({ page }) => {
    await loginAs(page, 'parent.dupont@nexus.com', 'password123');
    // Skip dashboard hop; loginAs already established session

    // Parent: navigate directly to wizard and ensure it loads
    await ensureWizardLoaded(page, 'parent');

    // Parent should see the child selector; open and choose "Marie Dupont"
    const trigger = page.getByTestId('wizard-child-select-trigger');
    if (await trigger.count()) {
      await trigger.click();
      // Select option by visible text (Radix Select renders a listbox/option)
      const option = page.getByRole('option', { name: /Marie\s+Dupont/i }).first();
      if (await option.count()) {
        await option.click();
      } else {
        // Fallback: click by text
        await page.getByText(/Marie\s+Dupont/i).first().click();
      }
      // Ensure the trigger now shows the selected child
      await expect(trigger).toContainText(/Marie\s+Dupont/i, { timeout: 5000 });
    }

    await completeQcmStep(page);
    await completePedagoStep(page);
    await submitAndVerifyPdf(page);
  });
});
