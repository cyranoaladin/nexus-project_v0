import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

const CAMPAIGN_PATH = '/stages/pre-rentree-2026';
const EVIDENCE_DIR = '/tmp/nexus-pre-rentree-2026-evidence';

async function openConfigurator(page: Page, level: 'Seconde' | 'Première' | 'Terminale') {
  await page.goto(CAMPAIGN_PATH);
  await page.locator('#configurateur').getByRole('radio', { name: level }).click();
  await page.locator('#configurateur').getByRole('button', { name: 'Continuer' }).click();
}

async function completePremiereProfile(page: Page) {
  await page.getByRole('radio', { name: 'Voie générale', exact: true }).click();
  await page.getByRole('radio', { name: 'Maths EDS', exact: true }).click();
  await page.getByRole('radio', { name: 'EAF voie générale', exact: true }).click();
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
    expect(bilanHref).toContain('pack=pre2026-pack-4');
    expect(bilanHref).toContain('niveau=TERMINALE');
    expect(bilanHref).not.toMatch(/prix|price/i);

    const whatsapp = page.getByRole('link', { name: /Vérifier sur WhatsApp/ });
    const whatsappHref = await whatsapp.getAttribute('href');
    expect(whatsappHref).toMatch(/^https:\/\/wa\.me\/21699192829\?text=/);
    const message = decodeURIComponent(new URL(whatsappHref ?? '').searchParams.get('text') ?? '');
    expect(message).toContain('Volume : 40 heures');
    expect(message).toContain('Pack : pre2026-pack-4');
    expect(message).not.toMatch(/email|téléphone|établissement/i);

    await bilan.click();
    await expect(page).toHaveURL(/\/bilan-gratuit\?/);
    await expect(page.locator('#studentGrade')).toHaveValue('terminale');
    await expect(page.getByText(/Préremplissage modifiable · Pré-rentrée 2026/)).toBeVisible();
    await expect(page.getByText(/Offre repérée.*4 matières/)).toBeVisible();
  });

  test('rend planning, programmes et FAQ accessibles au clavier', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const levelView = page.getByRole('tab', { name: 'Par niveau' });
    await levelView.focus();
    await levelView.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Par semaine' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Par semaine' })).toContainText('Bloc A');

    const programme = page.getByRole('button', { name: /Mathématiques Seconde/i });
    await programme.focus();
    await programme.press('Enter');
    await expect(programme).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: /Détail Mathématiques/i })).toContainText('Séance 5');

    const faq = page.getByRole('button', { name: 'Mon enfant peut-il suivre plusieurs matières ?' });
    await faq.focus();
    await faq.press('Enter');
    await expect(faq).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: 'Mon enfant peut-il suivre plusieurs matières ?' })).toBeVisible();
  });

  test('reste utilisable à 390 px et 320 px, sans paiement ni disponibilité inventée', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto(CAMPAIGN_PATH);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByText('Aucun paiement en ligne n’est demandé sur cette page.')).toBeVisible();
      await expect(page.getByText(/places restantes/i)).toHaveCount(0);

      await page.locator('#configurateur').getByRole('radio', { name: 'Seconde' }).click();
      await page.locator('#configurateur').getByRole('button', { name: 'Continuer' }).click();
      await page.locator('#configurateur').getByRole('checkbox').first().click();
      const summaryToggle = page.getByRole('button', { name: 'Afficher le résumé' });
      await expect(summaryToggle).toHaveAttribute('aria-expanded', 'false');
      await summaryToggle.click();
      await expect(page.getByRole('link', { name: 'Poursuivre vers le bilan prérempli' })).toBeVisible();
      await page.getByRole('button', { name: 'Réduire le résumé' }).click();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('produit les captures de preuve non commitées', async ({ page }) => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    for (const viewport of [
      { name: 'desktop-1440x1000', width: 1440, height: 1000 },
      { name: 'tablet-768x1024', width: 768, height: 1024 },
      { name: 'mobile-390x844', width: 390, height: 844 },
      { name: 'mobile-320x800', width: 320, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(CAMPAIGN_PATH);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${EVIDENCE_DIR}/${viewport.name}.png`, fullPage: true });
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(CAMPAIGN_PATH);
    await page.locator('main > section').first().screenshot({ path: `${EVIDENCE_DIR}/hero.png` });
    await page.locator('#configurateur').screenshot({ path: `${EVIDENCE_DIR}/configurator-empty.png` });

    await openConfigurator(page, 'Première');
    await completePremiereProfile(page);
    const twoSubjects = page.locator('#configurateur').getByRole('checkbox');
    await twoSubjects.nth(0).click();
    await twoSubjects.nth(1).click();
    await page.getByRole('button', { name: 'Voir mon résumé' }).click();
    await page.locator('#configurateur').screenshot({ path: `${EVIDENCE_DIR}/configurator-two-subjects.png` });

    await openConfigurator(page, 'Terminale');
    await completeTerminaleProfile(page);
    const fourSubjects = page.locator('#configurateur').getByRole('checkbox');
    for (let index = 0; index < 4; index += 1) await fourSubjects.nth(index).click();
    await page.getByRole('button', { name: 'Voir mon résumé' }).click();
    await page.locator('#configurateur').screenshot({ path: `${EVIDENCE_DIR}/configurator-four-subjects.png` });

    const planning = page.locator('#planning');
    for (const level of ['Seconde', 'Première', 'Terminale']) {
      await planning.getByRole('button', { name: level }).click();
      await planning.screenshot({ path: `${EVIDENCE_DIR}/planning-${level.toLowerCase()}.png` });
    }

    const programme = page.getByRole('button', { name: /Mathématiques Seconde/i });
    await programme.click();
    await page.locator('#programme-mathematiques').screenshot({ path: `${EVIDENCE_DIR}/program-open.png` });

    const faq = page.getByRole('button', { name: 'Mon enfant peut-il suivre plusieurs matières ?' });
    await faq.click();
    await page.locator('section[aria-labelledby="faq-heading"]').screenshot({ path: `${EVIDENCE_DIR}/faq.png` });
    await page.getByRole('heading', { name: 'Prêt à préparer la rentrée ?' }).locator('..').screenshot({ path: `${EVIDENCE_DIR}/final-cta.png` });
  });
});
