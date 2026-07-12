import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const CAMPAIGN_PATH = '/stages/pre-rentree-2026';
const EVIDENCE_DIR = '/tmp/nexus-pre-rentree-2026-final-integrated-release';

async function openConfigurator(page: Page, level: 'Seconde' | 'Première' | 'Terminale') {
  await page.goto(CAMPAIGN_PATH);
  await page.locator('#configurateur').getByRole('radio', { name: `Entrée en ${level}` }).click();
  await page.locator('#configurateur').getByRole('button', { name: 'Continuer' }).click();
}

async function completePremiereProfile(page: Page) {
  await page.getByRole('radio', { name: 'Voie générale', exact: true }).click();
  await page.getByRole('radio', { name: 'Maths EDS', exact: true }).click();
  await page.getByRole('radio', { name: 'EAF voie générale', exact: true }).click();
  await page.getByRole('radio', { name: 'NSI et Physique-Chimie envisagées', exact: true }).click();
  await page.locator('#configurateur').getByRole('button', { name: 'Continuer' }).click();
}

async function completeTerminaleProfile(page: Page) {
  await page.getByRole('checkbox', { name: 'Mathématiques' }).click();
  await page.getByRole('checkbox', { name: 'Physique-Chimie' }).click();
  await page.getByRole('radio', { name: 'Aucune' }).click();
  await page.locator('#configurateur').getByRole('button', { name: 'Continuer' }).click();
}

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

test.describe('Landing Pré-rentrée 2026', () => {
  test('sert la route canonique, redirige la route courte et expose le SEO exact', async ({ page, request }) => {
    const canonical = await page.goto(CAMPAIGN_PATH);
    expect(canonical?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deux semaines pour préparer sérieusement la rentrée');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/stages\/pre-rentree-2026$/);
    await expect(page).toHaveTitle('Stages de pré-rentrée 2026 à Tunis | Nexus Réussite');

    const redirect = await request.get('/pre-rentree', { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe('/stages/pre-rentree-2026');
  });

  test('rend la campagne accessible en un clic depuis les quatre surfaces publiques', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    await expect(page.getByRole('link', { name: 'Pré-rentrée 2026', exact: true })).toHaveAttribute('href', CAMPAIGN_PATH);

    for (const source of ['/', '/stages', '/offres']) {
      await page.goto(source);
      const directLink = page.locator(`a[href="${CAMPAIGN_PATH}"]:visible`).first();
      await expect(directLink, `Lien direct absent depuis ${source}`).toBeVisible();
    }
  });

  test('utilise une seule barre campagne mobile et la masque dans les tunnels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('main > section').nth(4).scrollIntoViewIfNeeded();

    const quickActions = page.getByRole('navigation', { name: 'Actions rapides' });
    await expect(quickActions).toBeVisible();
    await expect(
      quickActions.getByRole('link', { name: 'Pré-rentrée 2026 — Voir les stages' }),
    ).toHaveAttribute('href', CAMPAIGN_PATH);
    await expect(page.getByRole('link', { name: 'Pré-rentrée 2026 — Voir les stages' })).toHaveCount(1);

    await page.goto(CAMPAIGN_PATH);
    await page.locator('#configurateur').scrollIntoViewIfNeeded();
    await expect(page.getByRole('navigation', { name: 'Actions rapides' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pré-rentrée 2026 — Voir les stages' })).toHaveCount(0);
  });

  test('couvre les profils Seconde, Première et Terminale sans profil fictif', async ({ page }) => {
    await openConfigurator(page, 'Seconde');
    await expect(page.locator('#configurateur').getByRole('checkbox')).toHaveCount(4);
    await expect(page.getByText('EDS NSI Seconde')).toHaveCount(0);

    await openConfigurator(page, 'Première');
    await expect(page.getByRole('radio', { name: 'Voie technologique', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Maths hors EDS' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'EAF voie technologique' })).toBeVisible();
    await completePremiereProfile(page);
    await expect(page.locator('#configurateur').getByRole('checkbox')).toHaveCount(4);
    await page.locator('#configurateur').getByRole('link', { name: 'Consulter le programme' }).first().click();
    await expect(page.getByRole('button', { name: /Mathématiques — Entrée en Première/i })).toHaveAttribute('aria-expanded', 'true');

    await openConfigurator(page, 'Terminale');
    await expect(page.getByRole('radio', { name: 'Maths expertes' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Maths complémentaires' })).toBeVisible();
    await completeTerminaleProfile(page);
    await expect(page.locator('#configurateur').getByRole('checkbox')).toHaveCount(4);
  });

  test('compose quatre matières, résout le pack 40 h et préremplit le bilan sans prix URL', async ({ page }) => {
    await openConfigurator(page, 'Terminale');
    await completeTerminaleProfile(page);
    const subjects = page.locator('#configurateur').getByRole('checkbox');
    await expect(subjects).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) await subjects.nth(index).click();
    await page.getByRole('button', { name: 'Voir mon résumé' }).click();

    await expect(page.getByText('20 séances · 40 heures')).toBeVisible();
    await expect(page.getByText(/validation du groupe par l'équipe Nexus/i)).toBeVisible();
    const bilan = page.getByRole('link', { name: 'Poursuivre vers le bilan prérempli' });
    const bilanHref = await bilan.getAttribute('href');
    expect(bilanHref).toContain('pack=PACK_4');
    expect(bilanHref).toContain('niveau=TERMINALE');
    expect(bilanHref).not.toMatch(/prix|price/i);

    const whatsapp = page.getByRole('link', { name: /Vérifier sur WhatsApp/ });
    const whatsappHref = await whatsapp.getAttribute('href');
    expect(whatsappHref).toMatch(/^https:\/\/wa\.me\/21699192829\?text=/);
    const message = decodeURIComponent(new URL(whatsappHref ?? '').searchParams.get('text') ?? '');
    expect(message).toContain('Classe de rentrée : Entrée en Terminale');
    expect(message).toContain('Volume : 40 heures');
    expect(message).toContain('Pack : 4 matières');
    expect(message).not.toContain('PACK_4');
    expect(message).toContain('lun. 17 août');
    expect(message).not.toMatch(/email|téléphone|établissement/i);

    await bilan.click();
    await expect(page).toHaveURL(/\/bilan-gratuit\?/);
    await expect(page.locator('#studentGrade')).toHaveValue('terminale');
    await expect(page.getByText('Classe de rentrée : Entrée en Terminale')).toBeVisible();
    await expect(page.getByText(/Préremplissage modifiable · Pré-rentrée 2026/)).toBeVisible();
    await expect(page.getByText(/Offre repérée.*4 matières/)).toBeVisible();
  });

  test('couvre le tunnel parent homepage vers landing, résumé et bilan prérempli', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('pre-rentree-home-spotlight').getByRole('link', {
      name: 'Découvrir la Pré-rentrée 2026',
    }).click();
    await expect(page).toHaveURL(new RegExp(`${CAMPAIGN_PATH}$`));

    const configurator = page.locator('#configurateur');
    await configurator.getByRole('radio', { name: 'Entrée en Seconde' }).click();
    await configurator.getByRole('button', { name: 'Continuer' }).click();
    await configurator.getByRole('checkbox', { name: /Mathématiques/i }).click();
    await configurator.getByRole('button', { name: 'Voir mon résumé' }).click();
    const bilan = configurator.getByRole('link', { name: 'Poursuivre vers le bilan prérempli' });
    await expect(bilan).toHaveAttribute('href', /pack=PACK_1/);
    await bilan.click();

    await expect(page).toHaveURL(/\/bilan-gratuit\?/);
    await expect(page.getByText('Classe de rentrée : Entrée en Seconde')).toBeVisible();
    await expect(page.getByText(/Préremplissage modifiable · Pré-rentrée 2026/)).toBeVisible();
  });

  test('bloque une contradiction certaine de profil avant le choix des matières', async ({ page }) => {
    await openConfigurator(page, 'Terminale');
    await page.getByRole('radio', { name: 'Maths expertes' }).click();

    await expect(page.locator('#configurateur').getByRole('alert')).toContainText(
      'Maths expertes nécessite la spécialité Mathématiques conservée.',
    );
    await expect(page.locator('#configurateur').getByRole('button', { name: 'Continuer' })).toBeDisabled();
  });

  test('rend planning, programmes et FAQ accessibles au clavier', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const levelView = page.getByRole('tab', { name: 'Par classe de rentrée' });
    await levelView.focus();
    await levelView.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Emploi du temps par semaine' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Semaine 1 · 17–21 août' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('table', { name: 'Emploi du temps — Semaine 1 · 17–21 août' })).toContainText('Bloc A');
    const weekOne = page.getByRole('tab', { name: 'Semaine 1 · 17–21 août' });
    await weekOne.focus();
    await weekOne.press('End');
    await expect(page.getByRole('tab', { name: 'Semaine 2 · 24–28 août' })).toHaveAttribute('aria-selected', 'true');

    const programme = page.getByRole('button', { name: /Mathématiques — Entrée en Seconde/i });
    await programme.focus();
    await programme.press('Enter');
    await expect(programme).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: /Détail Mathématiques/i })).toContainText('Séance 5');

    const faq = page.getByRole('button', { name: /Mon enfant entrant en Seconde, Première ou Terminale/i });
    await faq.focus();
    await faq.press('Enter');
    await expect(faq).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: /Mon enfant entrant en Seconde, Première ou Terminale/i })).toBeVisible();
  });

  test('synchronise configurateur, planning et programmes sans muter le formulaire depuis les vues', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const configurator = page.locator('#configurateur');
    const planning = page.locator('#planning');
    const programs = page.locator('#programmes');

    await expect(configurator.getByRole('radio', { name: 'Entrée en Seconde' })).not.toBeChecked();
    await expect(planning.getByRole('tab', { name: 'Entrée en Seconde' })).toHaveAttribute('aria-selected', 'true');
    await expect(programs.getByRole('tab', { name: 'Entrée en Seconde' })).toHaveAttribute('aria-selected', 'true');

    await configurator.getByRole('radio', { name: 'Entrée en Première' }).click();
    await expect(planning.getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute('aria-selected', 'true');
    await expect(programs.getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute('aria-selected', 'true');

    await planning.getByRole('tab', { name: 'Entrée en Terminale' }).click();
    await expect(configurator.getByRole('radio', { name: 'Entrée en Première' })).toBeChecked();
    await expect(programs.getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute('aria-selected', 'true');

    await programs.getByRole('tab', { name: 'Entrée en Terminale' }).click();
    await expect(configurator.getByRole('radio', { name: 'Entrée en Première' })).toBeChecked();
    await planning.getByRole('tab', { name: 'Entrée en Première' }).click();
    await expect(planning.getByRole('table', { name: 'Planning — Entrée en Première' })).toBeVisible();
  });

  test('ne laisse pas la bulle globale masquer les programmes ou la FAQ', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(CAMPAIGN_PATH);
    await page.locator('#planning').scrollIntoViewIfNeeded();

    await expect(
      page.getByRole('link', { name: /Échangez avec un conseiller Nexus/i }),
    ).toHaveCount(0);
  });

  test('ne présente aucune violation axe sérieuse ou critique dans les vues de campagne', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    await expectNoBlockingAxeViolations(page, '#planning');
    await page.getByRole('tab', { name: 'Emploi du temps par semaine' }).click();
    await expectNoBlockingAxeViolations(page, '#planning');
    await page.getByRole('tab', { name: 'Semaine 2 · 24–28 août' }).click();
    await expectNoBlockingAxeViolations(page, '#planning');
    await page.locator('#configurateur').getByRole('radio', { name: 'Entrée en Première' }).click();
    await expectNoBlockingAxeViolations(page, '#configurateur');
    await expectNoBlockingAxeViolations(page, '#programmes');
  });

  test('reste lisible avec un zoom navigateur à 200 %', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 500 });
    await page.goto(CAMPAIGN_PATH);
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Composer le stage de mon enfant' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('reste utilisable à 390 px et 320 px, sans paiement ni disponibilité inventée', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto(CAMPAIGN_PATH);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByText('Aucun paiement en ligne n’est demandé sur cette page.')).toBeVisible();
      await expect(page.getByText(/places restantes/i)).toHaveCount(0);

      await page.locator('#configurateur').getByRole('radio', { name: 'Entrée en Seconde' }).click();
      await page.locator('#configurateur').getByRole('button', { name: 'Continuer' }).click();
      await page.locator('#configurateur').getByRole('checkbox').first().click();
      const summaryToggle = page.getByRole('button', { name: 'Afficher le résumé' });
      await expect(summaryToggle).toHaveAttribute('aria-expanded', 'false');
      await summaryToggle.click();
      await expect(page.getByRole('link', { name: 'Poursuivre vers le bilan prérempli' })).toBeVisible();
      await page.getByRole('button', { name: 'Réduire le résumé' }).click();
      await page.locator('#planning').scrollIntoViewIfNeeded();
      await expect(page.locator('#planning').getByRole('article', { name: /Mathématiques, semaine 1/i })).toBeVisible();
      await expect(page.locator('#planning').getByRole('table', { name: 'Planning — Entrée en Seconde' })).not.toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('produit les captures de preuve non commitées', async ({ page }) => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(CAMPAIGN_PATH);
    await page.evaluate(() => document.fonts.ready);
    const planning = page.locator('#planning');
    for (const { level, slug } of [
      { level: 'Seconde', slug: 'seconde' },
      { level: 'Première', slug: 'premiere' },
      { level: 'Terminale', slug: 'terminale' },
    ] as const) {
      await planning.getByRole('tab', { name: `Entrée en ${level}` }).click();
      await captureSection(page, '#planning', `${EVIDENCE_DIR}/planning-par-classe-${slug}-desktop.png`);
    }
    await planning.getByRole('tab', { name: 'Emploi du temps par semaine' }).click();
    await captureSection(page, '#planning', `${EVIDENCE_DIR}/emploi-du-temps-semaine-1-desktop.png`);
    await planning.getByRole('tab', { name: 'Semaine 2 · 24–28 août' }).click();
    await captureSection(page, '#planning', `${EVIDENCE_DIR}/emploi-du-temps-semaine-2-desktop.png`);

    for (const viewport of [
      { name: 'planning-tablette.png', width: 768, height: 1024 },
      { name: 'planning-mobile-390.png', width: 390, height: 844 },
      { name: 'planning-mobile-320.png', width: 320, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(CAMPAIGN_PATH);
      await page.evaluate(() => document.fonts.ready);
      await captureSection(page, '#planning', `${EVIDENCE_DIR}/${viewport.name}`);
    }

    await page.setViewportSize({ width: 720, height: 500 });
    await page.goto(CAMPAIGN_PATH);
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    await captureSection(page, '#planning', `${EVIDENCE_DIR}/planning-zoom-200.png`);
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    await client.detach();

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(CAMPAIGN_PATH);
    await page.locator('#configurateur').getByRole('radio', { name: 'Entrée en Première' }).click();
    await expect(page.locator('#planning').getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: `${EVIDENCE_DIR}/configurateur-planning-synchronise.png`, fullPage: true });
    await expect(page.locator('#programmes').getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute('aria-selected', 'true');
    await captureSection(page, '#programmes', `${EVIDENCE_DIR}/programmes-synchronises.png`);
  });
});
