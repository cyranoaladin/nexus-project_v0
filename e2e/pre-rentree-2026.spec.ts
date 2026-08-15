import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import releaseGateMatrix from '@/content/pre-rentree-2026/release-gates.json';

const CAMPAIGN_PATH = '/stages/pre-rentree-2026';
const EVIDENCE_DIR = '/tmp/nexus-pre-rentree-2026-final-integrated-release';
const CAMPAIGN_IS_PUBLIC_READY = releaseGateMatrix.releaseStatus === 'PUBLIC_READY'
  && releaseGateMatrix.gates.every(({ value }) => value);

function planningSelector(page: Page) {
  return page.locator('#planning').getByRole('region', { name: 'Composez votre planning' });
}

async function choosePlanningSubjects(
  page: Page,
  level: 'QUATRIEME' | 'TROISIEME' | 'SECONDE' | 'PREMIERE' | 'TERMINALE',
  subjects: string[],
) {
  const selector = planningSelector(page);
  await selector.getByLabel('Classe de rentrée').selectOption(level);
  for (const subject of subjects) {
    await selector.getByRole('checkbox', { name: subject, exact: true }).click();
  }
  return selector;
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

if (CAMPAIGN_IS_PUBLIC_READY) {
test.describe('Landing Pré-rentrée 2026', () => {
  test('sert la route canonique, redirige la route courte et expose le SEO exact', async ({ page, request }) => {
    const canonical = await page.goto(CAMPAIGN_PATH);
    expect(canonical?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Préparez la rentrée avec des bases solides');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/stages\/pre-rentree-2026$/);
    await expect(page).toHaveTitle('Stages de pré-rentrée 2026 à Mutuelleville | Nexus Réussite');

    const redirect = await request.get('/pre-rentree', { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe('/stages/pre-rentree-2026');
  });

  test('rend la campagne accessible depuis ses trois surfaces publiques et son CTA planning', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    await expect(page.getByRole('link', { name: 'Construire mon planning' })).toHaveAttribute('href', '#planning');

    for (const source of ['/', '/stages', '/offres']) {
      await page.goto(source);
      const directLink = page.locator(`a[href="${CAMPAIGN_PATH}"]:visible`).first();
      await expect(directLink, `Lien direct absent depuis ${source}`).toBeVisible();
    }
  });

  test('utilise le spotlight mobile comme entrée campagne unique et le masque sur la landing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const spotlightLink = page.getByTestId('pre-rentree-home-spotlight')
      .getByRole('link', { name: 'Découvrir la Pré-rentrée 2026' });
    await expect(spotlightLink).toHaveAttribute('href', CAMPAIGN_PATH);
    await expect(page.locator(`a[href="${CAMPAIGN_PATH}"]`)).toHaveCount(1);

    await page.goto(CAMPAIGN_PATH);
    await planningSelector(page).scrollIntoViewIfNeeded();
    await expect(page.getByRole('navigation', { name: 'Actions rapides' })).toHaveCount(0);
    await expect(page.getByTestId('pre-rentree-home-spotlight')).toHaveCount(0);
  });

  test('couvre les cinq niveaux publiés et leurs matières sans profil fictif', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const selector = planningSelector(page);
    const expected = new Map([
      ['QUATRIEME', ['Mathématiques', 'Français']],
      ['TROISIEME', ['Mathématiques', 'Français']],
      ['SECONDE', ['Mathématiques', 'Français']],
      ['PREMIERE', ['Mathématiques', 'Physique-Chimie', 'Français — préparation à l’EAF', 'NSI', 'SVT']],
      // Arbitrage du 14/08/2026 : Philosophie, Mathématiques expertes et SVT
      // sont fermées en Terminale (aucun élève inscrit).
      ['TERMINALE', ['Mathématiques', 'Physique-Chimie', 'NSI']],
    ]);

    for (const [level, subjects] of expected) {
      await selector.getByLabel('Classe de rentrée').selectOption(level);
      await expect(selector.getByRole('checkbox')).toHaveCount(subjects.length);
      for (const subject of subjects) {
        await expect(selector.getByRole('checkbox', { name: subject, exact: true })).toBeVisible();
      }
    }
    await expect(page.getByText('EDS NSI Seconde')).toHaveCount(0);
  });

  test('ouvre les quatorze programmes publiés avec leurs cinq séances', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const programs = page.locator('#programmes');
    // Arbitrage du 14/08/2026 : Philosophie, Mathématiques expertes et SVT
    // fermées en Terminale (aucun élève inscrit) — Terminale retombe de 6 à 3
    // modules (Mathématiques, NSI, Physique-Chimie).
    const expected = new Map([
      ['Entrée en 4e', 2],
      ['Entrée en 3e', 2],
      ['Entrée en Seconde', 2],
      ['Entrée en Première', 5],
      ['Entrée en Terminale', 3],
    ]);

    let checked = 0;
    for (const [level, count] of expected) {
      await programs.getByRole('tab', { name: level }).click();
      const modules = programs.getByRole('tabpanel').getByRole('article');
      await expect(modules).toHaveCount(count);
      for (let index = 0; index < count; index += 1) {
        const toggle = modules.nth(index).getByRole('button');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(modules.nth(index).getByRole('region')).toContainText('Séance 5');
        checked += 1;
      }
    }
    expect(checked).toBe(14);
  });

  test('compose quatre matières, résout le pack 40 h et produit une demande non contractuelle', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const selector = await choosePlanningSubjects(page, 'TERMINALE', [
      'Mathématiques',
      'NSI',
      'SVT',
      'Mathématiques expertes',
    ]);

    await expect(selector.getByText('40 h', { exact: true })).toBeVisible();
    await expect(selector).toContainText(/sous réserve de disponibilité/i);
    const whatsapp = selector.getByRole('link', { name: 'Demander la disponibilité de ce parcours' });
    await expect(whatsapp).not.toHaveAttribute('aria-disabled', 'true');
    const whatsappHref = await whatsapp.getAttribute('href');
    expect(whatsappHref).toMatch(/^https:\/\/wa\.me\/21699192829\?text=/);
    const message = decodeURIComponent(new URL(whatsappHref ?? '').searchParams.get('text') ?? '');
    expect(message).toContain('Niveau : Entrée en Terminale');
    expect(message).toContain('Matières (4)');
    expect(message).toContain('sous réserve de places disponibles');
    expect(message).not.toMatch(/email|téléphone|établissement|prix|price/i);
  });

  test('couvre le tunnel parent homepage vers landing, planning et demande de disponibilité', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('pre-rentree-home-spotlight').getByRole('link', {
      name: 'Découvrir la Pré-rentrée 2026',
    }).click();
    await expect(page).toHaveURL(new RegExp(`${CAMPAIGN_PATH}$`));

    const selector = await choosePlanningSubjects(page, 'SECONDE', ['Mathématiques']);
    await expect(selector.getByText('10 h', { exact: true })).toBeVisible();
    const availability = selector.getByRole('link', { name: 'Demander la disponibilité de ce parcours' });
    await expect(availability).toBeVisible();
    await expect(availability).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('ignore le contexte campagne désactivé et soumet un bilan sans le rattacher au stage', async ({ page }) => {
    await page.goto('/bilan-gratuit?programme=pre-rentree-2026&pack=PACK_2&niveau=PREMIERE&matieres=MATHEMATIQUES,FRANCAIS&voie=GENERALE&profil_maths=MATHS_EDS&profil_eaf=EAF_GENERALE&projet_specialites=NSI_PHYSIQUE_CHIMIE');
    await expect(page.getByText(/Préremplissage modifiable · Pré-rentrée 2026/)).toHaveCount(0);
    await page.locator('#studentGrade').selectOption('premiere');
    await page.locator('#parentFirstName').fill('Test');
    await page.locator('#parentLastName').fill('Navigateur');
    await page.locator('#parentEmail').fill('test-navigateur@example.test');
    await page.locator('#parentPhone').fill('+21699192829');
    await page.locator('#studentFirstName').fill('Élève');
    await page.getByRole('checkbox', { name: /j.*accepte/i }).click();

    await page.route('**/api/bilan-gratuit', (route) => route.abort());
    const requestPromise = page.waitForRequest((request) => request.url().endsWith('/api/bilan-gratuit'));
    await page.locator('#demande-bilan form').getByRole('button', { name: /créer mon espace/i }).click();
    const request = await requestPromise;
    expect(request.postDataJSON()).not.toHaveProperty('campaignContext');
  });

  test('bloque une combinaison horaire réellement incompatible', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const selector = await choosePlanningSubjects(page, 'TERMINALE', [
      'Mathématiques',
      'Physique-Chimie',
      'NSI',
      'SVT',
    ]);

    await expect(selector.getByRole('alert')).toContainText(
      /même créneau|attente de|autre cohorte|vérification manuelle/i,
    );
    await expect(selector.getByRole('link', { name: 'Demander la disponibilité de ce parcours' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('rend planning, programmes et FAQ accessibles au clavier', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const levelView = page.getByRole('tab', { name: 'Par classe de rentrée' });
    await levelView.focus();
    await levelView.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Emploi du temps par semaine' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Fenêtre 1 — 17 au 21 août' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('table', { name: 'Emploi du temps — Fenêtre 1 — 17 au 21 août' })).toContainText('Bloc A');
    const weekOne = page.getByRole('tab', { name: 'Fenêtre 1 — 17 au 21 août' });
    await weekOne.focus();
    await weekOne.press('End');
    await expect(page.getByRole('tab', { name: 'Fenêtre 2 — 24 au 28 août (Terminale)' })).toHaveAttribute('aria-selected', 'true');

    const programs = page.locator('#programmes');
    await programs.getByRole('tab', { name: 'Entrée en Seconde' }).click();
    const programme = programs.getByRole('button', { name: /Mathématiques — Entrée en Seconde/i });
    await programme.focus();
    await programme.press('Enter');
    await expect(programme).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: /Détail Mathématiques/i })).toContainText('Séance 5');

    const faq = page.locator('section[aria-labelledby="faq-heading"]').getByRole('button').first();
    await faq.focus();
    await faq.press('Enter');
    await expect(faq).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${await faq.getAttribute('aria-controls')}`)).toBeVisible();
  });

  test('conserve le choix de composition lorsque les vues de consultation changent', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const selector = planningSelector(page);
    const planning = page.locator('#planning');
    const programs = page.locator('#programmes');

    await selector.getByLabel('Classe de rentrée').selectOption('PREMIERE');
    await selector.getByRole('checkbox', { name: 'Mathématiques', exact: true }).click();
    await expect(planning.getByRole('tab', { name: 'Entrée en 4e' })).toHaveAttribute('aria-selected', 'true');

    await planning.getByRole('tab', { name: 'Entrée en Terminale' }).click();
    await programs.getByRole('tab', { name: 'Entrée en Terminale' }).click();
    await expect(selector.getByLabel('Classe de rentrée')).toHaveValue('PREMIERE');
    await expect(selector.getByRole('checkbox', { name: 'Mathématiques', exact: true })).toBeChecked();
    await expect(selector.getByText('10 h', { exact: true })).toBeVisible();
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
    await page.getByRole('tab', { name: 'Fenêtre 2 — 24 au 28 août (Terminale)' }).click();
    await expectNoBlockingAxeViolations(page, '#planning');
    await planningSelector(page).getByLabel('Classe de rentrée').selectOption('PREMIERE');
    await expectNoBlockingAxeViolations(page, '#planning');
    await expectNoBlockingAxeViolations(page, '#programmes');
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

  test('reste utilisable à 390 px et 320 px, sans paiement ni disponibilité inventée', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto(CAMPAIGN_PATH);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole('link', { name: /pré-inscrire|réserver|payer/i })).toHaveCount(0);
      await expect(page.getByText(/places restantes/i)).toHaveCount(0);

      const selector = await choosePlanningSubjects(page, 'SECONDE', ['Mathématiques']);
      await expect(selector.getByText('10 h', { exact: true })).toBeVisible();
      await expect(selector.getByRole('link', { name: 'Demander la disponibilité de ce parcours' })).toBeVisible();
      await page.locator('#planning').scrollIntoViewIfNeeded();
      await expect(page.locator('#planning').getByRole('article', { name: 'Mathématiques' }).first()).toBeVisible();
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
    await planning.getByRole('tab', { name: 'Fenêtre 2 — 24 au 28 août (Terminale)' }).click();
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
    await choosePlanningSubjects(page, 'PREMIERE', ['Mathématiques']);
    await page.screenshot({ path: `${EVIDENCE_DIR}/composition-planning-desktop.png`, fullPage: true });
    await page.locator('#programmes').getByRole('tab', { name: 'Entrée en Première' }).click();
    await captureSection(page, '#programmes', `${EVIDENCE_DIR}/programmes-premiere.png`);
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

    const bilan = await page.goto('/bilan-gratuit?programme=pre-rentree-2026&pack=PACK_4&niveau=TERMINALE');
    expect(bilan?.status()).toBe(200);
    await expect(page.getByText(/Préremplissage modifiable · Pré-rentrée 2026/)).toHaveCount(0);
    await expect(page.getByText(/Offre repérée.*4 matières/)).toHaveCount(0);
  });
});
}
