import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const CAMPAIGN_PATH = '/stages/pre-rentree-2026';

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

test.describe('Candidat public Pré-rentrée 2026', () => {
  test('redirige le raccourci vers la page canonique', async ({ request }) => {
    const response = await request.get('/pre-rentree', { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    expect(response.headers().location).toBe('/stages/pre-rentree-2026');
  });

  test('rend les cinq niveaux et leurs seules matières canoniques', async ({ page }) => {
    const response = await page.goto(CAMPAIGN_PATH);
    expect(response?.status()).toBe(200);

    const subjectsSection = page.locator('section[aria-labelledby="subjects-heading"]');
    const expected = new Map([
      ['Entrée en 4e', ['Mathématiques', 'Français']],
      ['Entrée en 3e', ['Mathématiques', 'Français']],
      ['Entrée en Seconde', ['Mathématiques', 'Français']],
      ['Entrée en Première', ['Mathématiques', 'Français — préparation à l’EAF', 'NSI', 'Physique-Chimie', 'SVT']],
      // Arbitrage du 14/08/2026 : Philosophie, Mathématiques expertes et SVT
      // sont fermées en Terminale (aucun élève inscrit).
      ['Entrée en Terminale', ['Mathématiques', 'NSI', 'Physique-Chimie']],
    ]);

    for (const [level, subjects] of expected) {
      const card = subjectsSection.getByRole('article').filter({ hasText: level });
      await expect(card).toBeVisible();
      for (const subject of subjects) await expect(card.getByText(subject, { exact: true })).toBeVisible();
    }
    const seconde = subjectsSection.getByRole('article').filter({ hasText: 'Entrée en Seconde' });
    await expect(seconde.getByText('Physique-Chimie', { exact: true })).toHaveCount(0);
  });

  test('présente les cohortes alternatives sans doubler le volume élève', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const planning = page.locator('#planning');

    await planning.getByRole('tab', { name: 'Entrée en Première' }).click();
    const premiereSvt = planning.getByRole('table', { name: 'Planning — Entrée en Première' })
      .getByRole('row')
      .filter({ hasText: 'SVT' });
    await expect(premiereSvt).toContainText('5 séances · 10 h par élève');
    await expect(premiereSvt).toContainText('Deux créneaux possibles');
    await expect(premiereSvt).not.toContainText('10 séances · 20 h');

    await planning.getByRole('tab', { name: 'Entrée en Terminale' }).click();
    for (const subject of ['NSI', 'SVT']) {
      const row = planning.getByRole('table', { name: 'Planning — Entrée en Terminale' })
        .getByRole('row')
        .filter({ hasText: subject });
      await expect(row).toContainText('5 séances · 10 h par élève');
      await expect(row).toContainText('Deux créneaux possibles');
      await expect(row).not.toContainText('10 séances · 20 h');
    }

    await expect(planning).toContainText('La disponibilité du groupe est confirmée par notre équipe');
    await expect(planning).not.toContainText(/Salle [123]/);
  });

  test('plafonne à quatre matières et compose une demande de disponibilité non contractuelle', async ({ page }) => {
    await page.goto(CAMPAIGN_PATH);
    const selector = page.locator('#planning').getByRole('region', { name: 'Composez votre planning' });
    await selector.getByLabel('Classe de rentrée').selectOption('TERMINALE');

    const checkboxes = selector.getByRole('checkbox');
    await expect(checkboxes).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) await checkboxes.nth(index).click();

    await expect(selector.getByRole('alert')).toHaveText(
      '4 matières maximum — retirez une matière pour en ajouter une autre.',
    );
    await expect(selector.getByRole('checkbox', { checked: true })).toHaveCount(4);

    // The first four canonical subjects include the documented
    // PC + NSI + SVT collision. Replace PC with Maths expertes to exercise a
    // normal compact four-subject route before checking the active CTA.
    await selector.getByRole('checkbox', { name: 'Physique-Chimie' }).click();
    await selector.getByRole('checkbox', { name: 'Mathématiques expertes' }).click();
    await expect(selector.getByRole('checkbox', { checked: true })).toHaveCount(4);
    await expect(selector.getByText('40 h', { exact: true })).toBeVisible();

    const availability = selector.getByRole('link', { name: 'Demander la disponibilité de ce parcours' });
    await expect(availability).toBeVisible();
    await expect(availability).not.toHaveAttribute('aria-disabled', 'true');
    const href = await availability.getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/21699192829\?text=/);
    const message = decodeURIComponent(new URL(href ?? '').searchParams.get('text') ?? '');
    expect(message).toContain('Niveau : Entrée en Terminale');
    expect(message).toContain('Profil :');
    expect(message).toContain('Matières (4)');
    expect(message).toContain('Dates :');
    expect(message).toContain('Horaire :');
    expect(message).toContain('Cohorte proposée :');
    expect(message).toContain('Attente maximale :');
    expect(message).toContain('sous réserve de places disponibles');
  });

  test('expose huit PDF et reste lisible, accessible et sans erreur console', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(CAMPAIGN_PATH);
      await expectNoHorizontalOverflow(page);
    }

    const pdfLinks = page.locator('a[href^="/documents/pre-rentree-2026/"][href$=".pdf"]');
    await expect(pdfLinks).toHaveCount(8);
    const reservation = page.getByRole('heading', {
      name: 'Construisons le bon parcours pour votre enfant',
    }).locator('..');
    await expect(reservation).toContainText(/transmise sans paiement/i);
    await expect(reservation).toContainText(/ne réserve pas une place/i);
    await expect(page.getByRole('link', { name: /pré-inscrire|réserver|payer/i })).toHaveCount(0);

    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
