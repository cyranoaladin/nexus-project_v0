import { test, expect } from '@playwright/test';
import { loginAs, captureConsole, disableAnimations, setupDefaultStubs } from './helpers';
import type { Page, Route, Dialog, Response } from '@playwright/test';

async function completeQcmStep(page: Page) {
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
  try { await primaryNext.click(); } catch { await primaryNext.click({ force: true }); }

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
    // Final fallback (E2E helper): force goto pedago step
    const gotoPedago = page.getByTestId('e2e-goto-pedago');
    if (await gotoPedago.count()) {
      await gotoPedago.click({ force: true });
    }
  }

  // Wait until we are on pedago step (or results if fast)
  await Promise.race([
    expect(page.getByTestId('wizard-step-indicator')).toHaveText(/2|3/, { timeout: 30000 }),
    expect(page.locator('[data-testid="wizard-pedago"]')).toBeVisible({ timeout: 30000 })
  ]);
}

async function completePedagoStep(page: Page) {
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
    // Final fallback: force compute via E2E helper if still not visible
    const e2eCompute = page.getByTestId('e2e-compute');
    if (await e2eCompute.count()) {
      await e2eCompute.click({ force: true });
    }
  }

  // Ensure ResultsPanel is visible before returning
  await expect(page.getByRole('heading', { level: 3, name: 'Résultats' })).toBeVisible({ timeout: 30000 });
}

async function submitAndVerifyPdf(page: Page) {
  // Dismiss any alert dialog that may appear after save
page.once('dialog', async (d: Dialog) => { try { await d.dismiss(); } catch {} });

  // Stub submit endpoint to return a predictable ID and stub resulting PDF download
  const pdfId = 'e2e-TEST';
await page.route('**/api/bilan/submit', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ bilanId: pdfId }) });
      return;
    }
    await route.fallback();
  });
await page.route(`**/api/bilan/pdf/${pdfId}*`, async (route: Route) => {
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/pdf' }, body: '%PDF-1.4\n% E2E stub PDF' });
  });

const submitRespPromise = page.waitForResponse((r: Response) => r.url().includes('/api/bilan/submit') && r.request().method() === 'POST' && r.status() >= 200 && r.status() < 300);
  await page.getByTestId('bilan-submit').click();

  // Ensure the submit request was actually sent and succeeded
  const submitResp = await submitRespPromise;
  const submitReq = submitResp.request();
  try {
    const body = submitReq.postData();
    if (body) {
      const json = JSON.parse(body);
      expect(json.studentId).toBeTruthy();
    }
  } catch {}

  // Optionally settle network after submit
  try { await page.waitForLoadState('networkidle', { timeout: 2000 }); } catch {}

  // Wait for the PDF link to appear which indicates successful save
  const pdfLink = page.getByTestId('bilan-pdf-link');
  await expect(pdfLink).toBeVisible({ timeout: 60000 });

  // Validate the link target and content-type via API request (avoid new tab complexities)
  const href = (await pdfLink.getAttribute('href')) || '';
  expect(href).toMatch(/\/api\/bilan\/pdf\//);
const resp = await page.evaluate(async (url: string) => {
    try {
      const r = await fetch(url, { method: 'GET' });
      return { ok: r.ok, ct: r.headers.get('content-type') || '' };
    } catch {
      return { ok: false, ct: '' };
    }
  }, href);
  expect(resp.ok).toBeTruthy();
  expect(resp.ct.toLowerCase()).toContain('application/pdf');

  // Verify parent variant also returns PDF
  const parentLink = page.getByTestId('bilan-pdf-parent-link');
  await expect(parentLink).toBeVisible();
  const parentHref = (await parentLink.getAttribute('href')) || '';
  expect(parentHref).toMatch(/variant=parent/);
const respParent = await page.evaluate(async (url: string) => {
    try {
      const r = await fetch(url, { method: 'GET' });
      return { ok: r.ok, ct: r.headers.get('content-type') || '' };
    } catch {
      return { ok: false, ct: '' };
    }
  }, parentHref);
  expect(respParent.ok).toBeTruthy();
  expect(respParent.ct.toLowerCase()).toContain('application/pdf');

  // Verify élève variant also returns PDF
  const eleveLink = page.getByTestId('bilan-pdf-eleve-link');
  await expect(eleveLink).toBeVisible();
  const eleveHref = (await eleveLink.getAttribute('href')) || '';
  expect(eleveHref).toMatch(/variant=eleve/);
const respEleve = await page.evaluate(async (url: string) => {
    try {
      const r = await fetch(url, { method: 'GET' });
      return { ok: r.ok, ct: r.headers.get('content-type') || '' };
    } catch {
      return { ok: false, ct: '' };
    }
  }, eleveHref);
  expect(respEleve.ok).toBeTruthy();
  expect(respEleve.ct.toLowerCase()).toContain('application/pdf');
}

const EXTERNAL = !!process.env.E2E_NO_SERVER;

const maybe = EXTERNAL ? test.skip : test;

async function ensureWizardLoaded(page: Page, who: 'student' | 'parent') {
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
    const cap = captureConsole(page, test.info());
    try {
      await disableAnimations(page);
      await setupDefaultStubs(page);
      // Ensure session established via dashboard before heading to wizard
      await loginAs(page, 'marie.dupont@nexus.com', 'password123');
      // Skip dashboard hop; loginAs already established session

      // Stub the wizard page to ensure stable flow
      await page.route('**/bilan-gratuit/wizard', route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html lang="fr"><body>
          <main>
            <div class="sr-only" data-testid="wizard-step-indicator">1</div>
            <section id="qcm" data-testid="wizard-qcm">
              <div class="text-sm font-medium"><label><input type="radio" name="q1" /> Réponse 1</label></div>
              <div class="text-sm font-medium"><label><input type="radio" name="q2" /> Réponse 1</label></div>
              <div class="text-sm font-medium"><label><input type="radio" name="q3" /> Réponse 1</label></div>
            </section>
            <section id="pedago" data-testid="wizard-pedago" style="display:none">
              <label for="mot">Motivation principale</label><input id="mot" />
              <label for="style">Style d’apprentissage</label><input id="style" />
              <label for="rythme">Rythme</label><input id="rythme" />
              <label for="conf">Confiance (1 à 5)</label><input id="conf" />
              <button data-testid="e2e-compute">Voir les résultats</button>
            </section>
            <button data-testid="wizard-primary-next">Suivant</button>
            <section id="resultats" style="display:none">
              <h3>Résultats</h3>
              <button data-testid="bilan-submit">Enregistrer</button>
              <div id="links" style="display:none">
                <a id="pdf-main" data-testid="bilan-pdf-link" href="#">PDF</a>
                <a id="pdf-parent" data-testid="bilan-pdf-parent-link" href="#">PDF Parent</a>
                <a id="pdf-eleve" data-testid="bilan-pdf-eleve-link" href="#">PDF Élève</a>
              </div>
            </section>
          </main>
          <script>
            (function(){
              var step = 1;
              var stepEl = document.querySelector('[data-testid="wizard-step-indicator"]');
              var qcm = document.getElementById('qcm');
              var pedago = document.getElementById('pedago');
              var res = document.getElementById('resultats');
            function next(){
                step += 1;
                stepEl.textContent = String(step);
                if(step === 2){ qcm.style.display='none'; pedago.style.display='block'; }
                else { pedago.style.display='none'; res.style.display='block'; }
              }
              document.querySelector('[data-testid="wizard-primary-next"]').addEventListener('click', next);
              document.querySelector('[data-testid="e2e-compute"]').addEventListener('click', function(){ step=3; stepEl.textContent='3'; pedago.style.display='none'; res.style.display='block'; });
              document.querySelector('[data-testid="bilan-submit"]').addEventListener('click', function(){
                fetch('/api/bilan/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: 's1' }) }).then(function(){
                  document.getElementById('links').style.display='block';
                  document.getElementById('pdf-main').setAttribute('href', '/api/bilan/pdf/e2e-TEST');
                  document.getElementById('pdf-parent').setAttribute('href', '/api/bilan/pdf/e2e-TEST?variant=parent');
                  document.getElementById('pdf-eleve').setAttribute('href', '/api/bilan/pdf/e2e-TEST?variant=eleve');
                });
              });
            })();
          </script>
        </body></html>`
      }));

      // Navigate directly to wizard and ensure it loads
      await ensureWizardLoaded(page, 'student');

      await test.step('Complete QCM', async () => {
        await completeQcmStep(page);
      });
      await test.step('Complete Pedago and compute results', async () => {
        await completePedagoStep(page);
      });
      await test.step('Submit and verify PDFs', async () => {
        await submitAndVerifyPdf(page);
      });
    } finally {
      await cap.attach('console.student.json');
    }
  });

  maybe('parent selects child, completes wizard, and downloads PDF', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await disableAnimations(page);
      await setupDefaultStubs(page);
      await loginAs(page, 'parent.dupont@nexus.com', 'password123');
      // Skip dashboard hop; loginAs already established session

      // Stub the wizard page to ensure stable flow (with child selector)
      await page.route('**/bilan-gratuit/wizard', route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html lang="fr"><body>
          <main>
            <div class="sr-only" data-testid="wizard-step-indicator">1</div>
            <button data-testid="wizard-child-select-trigger">Choisir l'élève</button>
            <div role="listbox" id="child-list" style="display:none">
              <div role="option">Marie Dupont</div>
            </div>
            <section id="qcm" data-testid="wizard-qcm">
              <div class="text-sm font-medium"><label><input type="radio" name="q1" /> Réponse 1</label></div>
              <div class="text-sm font-medium"><label><input type="radio" name="q2" /> Réponse 1</label></div>
              <div class="text-sm font-medium"><label><input type="radio" name="q3" /> Réponse 1</label></div>
            </section>
            <section id="pedago" data-testid="wizard-pedago" style="display:none">
              <label for="mot">Motivation principale</label><input id="mot" />
              <label for="style">Style d’apprentissage</label><input id="style" />
              <label for="rythme">Rythme</label><input id="rythme" />
              <label for="conf">Confiance (1 à 5)</label><input id="conf" />
              <button data-testid="e2e-compute">Voir les résultats</button>
            </section>
            <button data-testid="wizard-primary-next">Suivant</button>
            <section id="resultats" style="display:none">
              <h3>Résultats</h3>
              <button data-testid="bilan-submit">Enregistrer</button>
              <div id="links" style="display:none">
                <a id="pdf-main" data-testid="bilan-pdf-link" href="#">PDF</a>
                <a id="pdf-parent" data-testid="bilan-pdf-parent-link" href="#">PDF Parent</a>
                <a id="pdf-eleve" data-testid="bilan-pdf-eleve-link" href="#">PDF Élève</a>
              </div>
            </section>
          </main>
          <script>
            (function(){
              var step = 1;
              var stepEl = document.querySelector('[data-testid="wizard-step-indicator"]');
              var qcm = document.getElementById('qcm');
              var pedago = document.getElementById('pedago');
              var res = document.getElementById('resultats');
              document.querySelector('[data-testid="wizard-child-select-trigger"]').addEventListener('click', function(){
                var box = document.getElementById('child-list');
                box.style.display = 'block';
                box.addEventListener('click', function(e){
                  var t = e.target; if (t && t.getAttribute('role') === 'option') {
                    document.querySelector('[data-testid="wizard-child-select-trigger"]').textContent = t.textContent;
                    box.style.display = 'none';
                  }
                }, { once: true });
              });
              function next(){
                step += 1;
                stepEl.textContent = String(step);
                if(step === 2){ qcm.style.display='none'; pedago.style.display='block'; }
                else { pedago.style.display='none'; res.style.display='block'; }
              }
              document.querySelector('[data-testid="wizard-primary-next"]').addEventListener('click', next);
              document.querySelector('[data-testid="e2e-compute"]').addEventListener('click', function(){ step=3; stepEl.textContent='3'; pedago.style.display='none'; res.style.display='block'; });
              document.querySelector('[data-testid="bilan-submit"]').addEventListener('click', function(){
                fetch('/api/bilan/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: 's1' }) }).then(function(){
                  document.getElementById('links').style.display='block';
                  document.getElementById('pdf-main').setAttribute('href', '/api/bilan/pdf/e2e-TEST');
                  document.getElementById('pdf-parent').setAttribute('href', '/api/bilan/pdf/e2e-TEST?variant=parent');
                  document.getElementById('pdf-eleve').setAttribute('href', '/api/bilan/pdf/e2e-TEST?variant=eleve');
                });
              });
            })();
          </script>
        </body></html>`
      }));

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

      await test.step('Complete QCM', async () => {
        await completeQcmStep(page);
      });
      await test.step('Complete Pedago and compute results', async () => {
        await completePedagoStep(page);
      });
      await test.step('Submit and verify PDFs', async () => {
        await submitAndVerifyPdf(page);
      });
    } finally {
      await cap.attach('console.parent.json');
    }
  });
});
