import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import releaseGateMatrix from '@/content/pre-rentree-2026/release-gates.json';

const CAMPAIGN_PATH = '/stages/pre-rentree-2026';
const EVIDENCE_DIR = '/tmp/nexus-pre-rentree-2026-informational-release';
const CAMPAIGN_IS_PUBLIC_READY = releaseGateMatrix.releaseStatus === 'PUBLIC_READY'
  && releaseGateMatrix.gates.every(({ value }) => value);

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

async function expectNoBlockingAxeViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  const results = await (include ? builder.include(include) : builder).analyze();
  const blockingViolations = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blockingViolations).toEqual([]);
}

async function captureSection(page: Page, selector: string, path: string) {
  const headerDisplays = await page.locator('header').evaluateAll((headers) => headers.map((header) => {
    const element = header as HTMLElement;
    const current = element.style.display;
    element.style.display = 'none';
    return current;
  }));
  try {
    await page.locator(selector).screenshot({ path });
  } finally {
    await page.locator('header').evaluateAll((headers, displays) => {
      headers.forEach((header, index) => {
        (header as HTMLElement).style.display = displays[index] ?? '';
      });
    }, headerDisplays);
  }
}

if (CAMPAIGN_IS_PUBLIC_READY) {
  test.describe('Landing informationnelle Pré-rentrée 2026', () => {
    test('sert la route canonique, le DTO public sanitizé et le SEO exact', async ({ page, request }) => {
      const canonical = await page.goto(CAMPAIGN_PATH);
      expect(canonical?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Préparez la rentrée avec des bases solides',
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        /\/stages\/pre-rentree-2026$/,
      );
      await expect(page).toHaveTitle('Stages de pré-rentrée 2026 à Mutuelleville | Nexus Réussite');

      const redirect = await request.get('/pre-rentree', { maxRedirects: 0 });
      expect(redirect.status()).toBe(308);
      expect(redirect.headers().location).toBe(CAMPAIGN_PATH);
    });

    test('rend la campagne accessible uniquement depuis les surfaces publiques autorisées', async ({ page }) => {
      for (const source of ['/', '/stages', '/offres']) {
        await page.goto(source);
        const directLink = page.locator(`a[href="${CAMPAIGN_PATH}"]:visible`).first();
        await expect(directLink, `Lien direct absent depuis ${source}`).toBeVisible();
      }
    });

    test('conserve le gate de navigation permanente fermé sur desktop et mobile', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('/');
      await expect(page.getByTestId('pre-rentree-nav-desktop')).toHaveCount(0);

      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto('/');
      await expect(page.getByTestId('pre-rentree-nav-mobile')).toHaveCount(0);
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
      await expect(
        page.getByRole('dialog', { name: 'Menu principal' }).getByRole('link', { name: /Se connecter/i }),
      ).toHaveAttribute('href', '/auth/signin');
    });

    test('présente les classes publiées sans inventer Physique-Chimie Seconde', async ({ page }) => {
      await page.goto(CAMPAIGN_PATH);
      const subjects = page.locator('section[aria-labelledby="subjects-heading"]');
      await expect(subjects.getByRole('heading', { level: 3 })).toHaveCount(5);
      const seconde = subjects.getByRole('heading', { name: 'Entrée en Seconde' }).locator('..');
      await expect(seconde).toBeVisible();
      await expect(seconde).not.toContainText('Physique-Chimie');
      await expect(page.getByText('EDS NSI Seconde')).toHaveCount(0);
    });

    test('ouvre chaque module public avec cinq séances sans exposer de corrigé', async ({ page }) => {
      await page.goto(CAMPAIGN_PATH);
      const programs = page.locator('#programmes');
      const tabs = programs.getByRole('tab');
      expect(await tabs.count()).toBeGreaterThanOrEqual(3);

      for (let index = 0; index < await tabs.count(); index += 1) {
        await tabs.nth(index).click();
        const moduleButton = programs.locator('#program-list').getByRole('button').first();
        await expect(moduleButton).toBeVisible();
        await moduleButton.click();
        const panelId = await moduleButton.getAttribute('aria-controls');
        expect(panelId).toBeTruthy();
        const detail = programs.locator(`#${panelId}`);
        await expect(detail).toBeVisible();
        await expect(detail.getByRole('heading', { level: 4 })).toHaveCount(5);
        await expect(detail).not.toContainText(/réponse attendue|bonne réponse|answer key/i);
        await expect(detail.locator('[data-correct-answer], [data-answer-key]')).toHaveCount(0);
      }
    });

    test('compose un parcours et demande uniquement une disponibilité WhatsApp', async ({ page }) => {
      await page.goto(CAMPAIGN_PATH);
      const planner = page.locator('section[aria-labelledby="planning-selector-heading"]');
      await planner.getByLabel('Classe de rentrée').selectOption('TERMINALE');
      const choices = planner.getByRole('checkbox');
      expect(await choices.count()).toBeGreaterThanOrEqual(4);
      await choices.first().click();

      const availability = planner.getByRole('link', {
        name: 'Demander la disponibilité de ce parcours',
      });
      await expect(availability).toHaveAttribute('href', /^https:\/\/wa\.me\/21699192829\?text=/);
      await expect(planner.locator('a[href*="/bilan-gratuit"]')).toHaveCount(0);
      await expect(planner.getByText(/paiement en ligne/i)).toHaveCount(0);
    });

    test('couvre le tunnel homepage vers la landing sans préremplir le bilan', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('pre-rentree-home-spotlight').getByRole('link', {
        name: 'Découvrir la Pré-rentrée 2026',
      }).click();
      await expect(page).toHaveURL(new RegExp(`${CAMPAIGN_PATH}$`));
      await expect(page.locator('section[aria-labelledby="planning-selector-heading"]')).toBeVisible();
      await expect(page.locator('a[href*="/bilan-gratuit?programme=pre-rentree-2026"]')).toHaveCount(0);
    });

    test('ignore le contexte de préremplissage bilan tant que son gate reste fermé', async ({ page }) => {
      await page.goto(
        '/bilan-gratuit?programme=pre-rentree-2026&pack=PACK_4&niveau=TERMINALE&matieres=MATHEMATIQUES,NSI',
      );
      await expect(page.getByText(/Préremplissage modifiable · Pré-rentrée 2026/)).toHaveCount(0);
      await expect(page.getByText(/Offre repérée.*4 matières/)).toHaveCount(0);
    });

    test('bloque explicitement une cinquième matière au lieu de fabriquer un pack', async ({ page }) => {
      await page.goto(CAMPAIGN_PATH);
      const planner = page.locator('section[aria-labelledby="planning-selector-heading"]');
      await planner.getByLabel('Classe de rentrée').selectOption('TERMINALE');
      const choices = planner.getByRole('checkbox');
      expect(await choices.count()).toBeGreaterThan(4);
      for (let index = 0; index < 5; index += 1) {
        await choices.nth(index).click();
      }
      await expect(planner.getByRole('alert')).toContainText(/quatre matières|maximum/i);
      await expect(choices.nth(4)).not.toBeChecked();
    });

    test('rend planning, programmes et FAQ accessibles au clavier', async ({ page }) => {
      await page.goto(CAMPAIGN_PATH);

      const planningTabs = page.locator('#planning').getByRole('tablist', {
        name: 'Classe de rentrée affichée',
      });
      const planningFirst = planningTabs.getByRole('tab').first();
      await planningFirst.focus();
      await planningFirst.press('Tab');
      await expect(planningTabs.getByRole('tab').nth(1)).toBeFocused();

      const programTabs = page.locator('#programmes').getByRole('tablist', {
        name: 'Filtrer les programmes par classe de rentrée',
      });
      const programFirst = programTabs.getByRole('tab').first();
      await programFirst.focus();
      await programFirst.press('End');
      await expect(programTabs.getByRole('tab').last()).toBeFocused();

      const faq = page.locator('section[aria-labelledby="faq-heading"]').getByRole('button').first();
      await faq.focus();
      await faq.press('Enter');
      await expect(faq).toHaveAttribute('aria-expanded', 'true');
    });

    test('isole le composeur des vues de lecture pour éviter toute mutation implicite', async ({ page }) => {
      await page.goto(CAMPAIGN_PATH);
      const planner = page.locator('section[aria-labelledby="planning-selector-heading"]');
      const levelSelect = planner.getByLabel('Classe de rentrée');
      await levelSelect.selectOption('PREMIERE');

      const planning = page.locator('#planning');
      const programs = page.locator('#programmes');
      await expect(planning.getByRole('tab', { name: 'Entrée en 4e' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(programs.getByRole('tab', { name: 'Entrée en 4e' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await planning.getByRole('tab', { name: 'Entrée en Terminale' }).click();
      await expect(levelSelect).toHaveValue('PREMIERE');
      await expect(programs.getByRole('tab', { name: 'Entrée en 4e' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    test('ne laisse pas la bulle globale masquer les programmes ou la FAQ', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(CAMPAIGN_PATH);
      await page.locator('#planning').scrollIntoViewIfNeeded();
      await expect(page.getByRole('link', { name: /Échangez avec un conseiller Nexus/i })).toHaveCount(0);
    });

    test('ne présente aucune violation axe sérieuse ou critique sur les vues publiques', async ({ page }) => {
      await page.goto(CAMPAIGN_PATH);
      await expectNoBlockingAxeViolations(page, '#planning');
      await expectNoBlockingAxeViolations(page, '#programmes');
      await expectNoBlockingAxeViolations(page, 'section[aria-labelledby="faq-heading"]');
    });

    test('reste lisible avec un zoom navigateur à 200 %', async ({ page }) => {
      await page.setViewportSize({ width: 720, height: 500 });
      await page.goto(CAMPAIGN_PATH);
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Construire mon planning' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test('reste utilisable à 390 px et 320 px sans paiement ni disponibilité inventée', async ({ page }) => {
      for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 800 }]) {
        await page.setViewportSize(viewport);
        await page.goto(CAMPAIGN_PATH);
        await expectNoHorizontalOverflow(page);
        await expect(page.getByText(/places restantes/i)).toHaveCount(0);

        const planner = page.locator('section[aria-labelledby="planning-selector-heading"]');
        await planner.getByLabel('Classe de rentrée').selectOption('SECONDE');
        await planner.getByRole('checkbox').first().click();
        await expect(
          planner.getByRole('link', { name: 'Demander la disponibilité de ce parcours' }),
        ).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    });

    test('produit les captures de preuve informationnelles non commitées', async ({ page }) => {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      for (const viewport of [
        { name: 'desktop', width: 1440, height: 1000 },
        { name: 'mobile', width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(CAMPAIGN_PATH);
        await page.evaluate(() => document.fonts.ready);
        await captureSection(page, '#planning', `${EVIDENCE_DIR}/planning-${viewport.name}.png`);
        await captureSection(page, '#programmes', `${EVIDENCE_DIR}/programmes-${viewport.name}.png`);
      }
    });
  });
} else {
  test.describe('Gate public Pré-rentrée 2026', () => {
    test('masque les routes HTML, la route courte et les téléchargements avec noindex', async ({ request }) => {
      for (const path of [
        '/pre-rentree',
        CAMPAIGN_PATH,
        '/documents/pre-rentree-2026/Planning_PreRentree2026.pdf',
      ]) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), path).toBe(404);
        expect(response.headers()['x-robots-tag'], path).toBe('noindex, nofollow, noarchive');
      }
    });

    test('masque les API de détail et de préinscription avant toute validation de payload', async ({ request }) => {
      const detail = await request.get('/api/stages/pre-rentree-2026');
      expect(detail.status()).toBe(404);
      expect(await detail.json()).toEqual({ error: 'Stage introuvable' });

      const registration = await request.post('/api/stages/pre-rentree-2026/inscrire', {
        data: {},
      });
      expect(registration.status()).toBe(404);
      expect(await registration.json()).toEqual({ error: 'Stage introuvable' });
    });

    test('retire la campagne des surfaces publiques et de la liste API', async ({ page, request }) => {
      for (const source of ['/', '/stages', '/offres']) {
        const response = await page.goto(source);
        expect(response?.status(), source).toBe(200);
        await expect(page.locator(`a[href="${CAMPAIGN_PATH}"]`), source).toHaveCount(0);
      }

      const stages = await request.get('/api/stages');
      expect(stages.status()).toBe(200);
      expect(await stages.text()).not.toContain('pre-rentree-2026');
    });

    test('retire la campagne du sitemap et ignore son préremplissage bilan', async ({ page, request }) => {
      const sitemap = await request.get('/sitemap.xml');
      expect(sitemap.status()).toBe(200);
      expect(await sitemap.text()).not.toContain(CAMPAIGN_PATH);

      const bilan = await page.goto(
        '/bilan-gratuit?programme=pre-rentree-2026&pack=PACK_4&niveau=TERMINALE',
      );
      expect(bilan?.status()).toBe(200);
      await expect(page.getByText(/Préremplissage modifiable · Pré-rentrée 2026/)).toHaveCount(0);
      await expect(page.getByText(/Offre repérée.*4 matières/)).toHaveCount(0);
    });
  });
}
