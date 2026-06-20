import { expect, test, type Page, type TestInfo } from '@playwright/test';

type PublicPageCase = {
  url: string;
  h1: RegExp;
  cta: RegExp;
};

const PUBLIC_PAGES: PublicPageCase[] = [
  { url: '/', h1: /préparer le bac français avec méthode, suivi et exigence/i, cta: /bilan gratuit|offres|trouver ma formule/i },
  { url: '/offres', h1: /offres|tarifs|catalogue/i, cta: /réserver ma place|demander un bilan|poser une question/i },
  { url: '/recommandation', h1: /trouver ma formule|diagnostic/i, cta: /demander un bilan gratuit|offres|whatsapp/i },
  { url: '/bilan-gratuit', h1: /bilan stratégique gratuit/i, cta: /demander mon bilan stratégique gratuit|whatsapp|voir les offres/i },
  { url: '/stages', h1: /stages 2026\/2027|stages/i, cta: /pré-inscription|demander un bilan|whatsapp/i },
  { url: '/plateforme-aria', h1: /aria/i, cta: /demander un bilan|voir les offres/i },
  { url: '/accompagnement-scolaire', h1: /accompagnement scolaire|progresser avec méthode/i, cta: /demander un bilan gratuit|whatsapp|voir les offres/i },
  { url: '/contact', h1: /une question claire|contact/i, cta: /envoyer ma demande|demander un bilan|whatsapp/i },
  { url: '/notre-centre', h1: /mutuelleville|centre d’accompagnement/i, cta: /contacter l’équipe|whatsapp/i },
];

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 1200 },
  { label: 'mobile', width: 390, height: 1200 },
];

const INTERNAL_LINK_ALLOWLIST = new Set([
  '/',
  '/offres',
  '/recommandation',
  '/bilan-gratuit',
  '/stages',
  '/plateforme-aria',
  '/accompagnement-scolaire',
  '/contact',
  '/notre-centre',
  '/faq',
  '/ressources',
  '/politique-confidentialite',
]);

const EXTERNAL_LINK_ALLOWLIST = [
  'mailto:',
  'tel:',
  'https://wa.me/',
  'https://www.google.com/maps',
  'https://maps.google.com',
];

function isAllowedExternalHref(href: string) {
  return EXTERNAL_LINK_ALLOWLIST.some((prefix) => href.startsWith(prefix));
}

function shouldCheckInternalHref(href: string) {
  if (href.startsWith('/auth') || href.startsWith('/dashboard') || href.startsWith('/api')) {
    return false;
  }

  return true;
}

async function auditPublicPage(page: Page, testInfo: TestInfo, url: string, h1: RegExp, cta: RegExp, label: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('response', (response) => {
    const responseUrl = response.url();
    if (response.status() >= 400) {
      if (
        responseUrl.includes('_next/static') ||
        responseUrl.includes('_next/image') ||
        responseUrl.includes('favicon') ||
        responseUrl.includes('googletagmanager.com')
      ) {
        return;
      }
      networkErrors.push(`[${response.status()}] ${responseUrl}`);
    }
  });

  await page.setViewportSize({ width: label === 'mobile' ? 390 : 1440, height: 1200 });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${url} should respond 200`).toBe(200);

  await expect(page.locator('h1')).toHaveCount(1);
  const h1Locator = page.locator('h1').first();
  await expect(h1Locator).toBeVisible();
  await expect(h1Locator).toHaveText(h1);

  const ctaLink = page.getByRole('link', { name: cta }).first();
  const ctaButton = page.getByRole('button', { name: cta }).first();
  if (await ctaLink.isVisible().catch(() => false)) {
    await expect(ctaLink).toBeVisible();
  } else {
    await expect(ctaButton).toBeVisible();
  }

  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - window.innerWidth;
  });
  expect(overflow, `${url} has horizontal overflow`).toBeLessThanOrEqual(2);

  const visibleAnchors = await page.locator('a[href]').evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const el = node as HTMLAnchorElement;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0;

        return visible ? el.getAttribute('href') ?? '' : '';
      })
      .filter(Boolean),
  );

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  for (const href of visibleAnchors) {
    expect(href, `${url} contains an empty href`).not.toBe('');
    expect(href, `${url} should not contain href="#"`).not.toBe('#');

    if (href.startsWith('#')) {
      continue;
    }

    if (href.startsWith('/') || href.startsWith(`${process.env.NEXTAUTH_URL ?? 'https://nexusreussite.academy'}`)) {
      const normalized = href.startsWith('http')
        ? new URL(href).pathname + new URL(href).search + new URL(href).hash
        : href;
      if (shouldCheckInternalHref(normalized)) {
        internalLinks.push(normalized);
      }
      continue;
    }

    if (
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      isAllowedExternalHref(href)
    ) {
      externalLinks.push(href);
      continue;
    }

    externalLinks.push(href);
  }

  for (const href of internalLinks) {
    const response = await page.request.get(href, { failOnStatusCode: false });
    expect(response.status(), `${url} -> ${href} should not be broken`).toBeLessThan(400);
  }

  for (const err of consoleErrors) {
    expect(err, `${url} console error`).not.toMatch(/ResizeObserver|favicon/i);
  }

  expect(pageErrors, `${url} page errors: ${pageErrors.join('\n')}`).toHaveLength(0);
  expect(networkErrors, `${url} network errors: ${networkErrors.join('\n')}`).toHaveLength(0);

  const buttons = page.locator('button');
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    if (!(await button.isVisible().catch(() => false))) {
      continue;
    }
    if ((await button.getAttribute('role')) === 'checkbox') {
      continue;
    }

    const labelText = await button.evaluate((node) => {
      const element = node as HTMLButtonElement;
      const ariaLabel = element.getAttribute('aria-label')?.trim() ?? '';
      const title = element.getAttribute('title')?.trim() ?? '';
      const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      return ariaLabel || title || text;
    });
    expect(labelText, `${url} has a visible button without accessible text`).not.toBe('');

    const disabled = await button.isDisabled().catch(() => false);
    if (disabled) {
      continue;
    }

    const isFormButton = await button.evaluate((node) => {
      const element = node as HTMLButtonElement;
      return element.closest('form') !== null || element.type === 'submit' || element.type === 'reset';
    }).catch(() => false);
    if (isFormButton) {
      continue;
    }
  }

  const screenshotPath = testInfo.outputPath(`${label}${url === '/' ? '-home' : url.replace(/\//g, '_')}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });
  await testInfo.attach(`${label}-${url}-screenshot`, {
    path: screenshotPath,
    contentType: 'image/png',
  });

  return {
    internalLinks: internalLinks.length,
    externalLinks: externalLinks.length,
    visibleButtons: count,
  };
}

test.describe('Public front go-live smoke', () => {
  for (const pageCase of PUBLIC_PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${pageCase.url} (${viewport.label})`, async ({ page }, testInfo) => {
        const stats = await auditPublicPage(page, testInfo, pageCase.url, pageCase.h1, pageCase.cta, viewport.label);
        console.log(
          JSON.stringify({
            url: pageCase.url,
            viewport: viewport.label,
            internalLinks: stats.internalLinks,
            externalLinks: stats.externalLinks,
            visibleButtons: stats.visibleButtons,
          }),
        );
      });
    }
  }

  test('/recommandation completes the 3-step wizard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/recommandation', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const terminaleButton = page.getByRole('button', { name: /Terminale/i });
    const terminaleBox = await terminaleButton.boundingBox();
    expect(terminaleBox).not.toBeNull();
    await page.mouse.click(
      terminaleBox!.x + terminaleBox!.width / 2,
      terminaleBox!.y + terminaleBox!.height / 2,
    );
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: /Scolarisé/i })).toBeVisible();

    const scolariseButton = page.getByRole('button', { name: /Scolarisé/i });
    const scolariseBox = await scolariseButton.boundingBox();
    expect(scolariseBox).not.toBeNull();
    await page.mouse.click(
      scolariseBox!.x + scolariseBox!.width / 2,
      scolariseBox!.y + scolariseBox!.height / 2,
    );
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: /Accompagnement annuel/i })).toBeVisible();

    const annualButton = page.getByRole('button', { name: /Accompagnement annuel/i });
    const annualBox = await annualButton.boundingBox();
    expect(annualBox).not.toBeNull();
    await page.mouse.click(
      annualBox!.x + annualBox!.width / 2,
      annualBox!.y + annualBox!.height / 2,
    );
    await expect(page.getByText(/diagnostic complété/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /demander un bilan gratuit/i }).first()).toBeVisible();
  });

  test('/bilan-gratuit handles the public funnel without password', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/bilan-gratuit', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await page.getByLabel('Prénom du parent', { exact: true }).fill('Sara');
    await page.getByRole('textbox', { name: 'Nom du parent', exact: true }).fill('Ben Ali');
    await page.getByLabel('Email', { exact: true }).fill(`sara.${Date.now()}@example.com`);
    await page.locator('#parentPhone').fill('+216 99 19 28 29');
    await page.getByLabel('Prénom de l’élève', { exact: true }).fill('Amine');
    await page.getByLabel('Classe', { exact: true }).selectOption('premiere');
    await page.getByLabel('Établissement', { exact: true }).fill('Lycée français');
    const mathCheckbox = page.getByRole('checkbox', { name: 'Mathématiques' });
    await page.getByText('Mathématiques', { exact: true }).click();
    await expect(mathCheckbox).toBeChecked();
    await page.getByLabel('Besoin principal', { exact: true }).fill('Préparer une remise à niveau avant la rentrée.');
    await page.getByLabel('Message libre', { exact: true }).fill('Besoin d’un échange pédagogique pour clarifier les priorités.');
    const consentCheckbox = page.getByRole('checkbox', { name: /j’accepte d’être contacté/i });
    await page.getByText(/j’accepte d’être contacté/i).click();
    await expect(consentCheckbox).toBeChecked();

    await page.route('**/api/bilan-gratuit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, parentId: 'parent-1', studentId: 'student-1' }),
      });
    });

    await page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i }).click();
    await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation$/);
    await expect(page.getByRole('heading', { name: /demande de bilan a bien été enregistrée/i })).toBeVisible();
  });

  test('/bilan-gratuit rejects a bot honeypot and server failures are surfaced', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/bilan-gratuit', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.getByLabel('Prénom du parent', { exact: true }).fill('Sara');
    await page.getByRole('textbox', { name: 'Nom du parent', exact: true }).fill('Ben Ali');
    await page.getByLabel('Email', { exact: true }).fill(`sara.${Date.now()}@example.com`);
    await page.locator('#parentPhone').fill('+216 99 19 28 29');
    await page.getByLabel('Prénom de l’élève', { exact: true }).fill('Amine');
    await page.getByLabel('Classe', { exact: true }).selectOption('premiere');
    await page.getByLabel('Établissement', { exact: true }).fill('Lycée français');
    const mathCheckboxBot = page.getByRole('checkbox', { name: 'Mathématiques' });
    await page.getByText('Mathématiques', { exact: true }).click();
    await expect(mathCheckboxBot).toBeChecked();
    await page.getByLabel('Besoin principal', { exact: true }).fill('Préparer une remise à niveau avant la rentrée.');
    await page.getByLabel('Message libre', { exact: true }).fill('Besoin d’un échange pédagogique pour clarifier les priorités.');
    const consentCheckboxBot = page.getByRole('checkbox', { name: /j’accepte d’être contacté/i });
    await page.getByText(/j’accepte d’être contacté/i).click();
    await expect(consentCheckboxBot).toBeChecked();

    await page.locator('input[type="text"][aria-hidden="true"]').evaluate((node) => {
      const input = node as HTMLInputElement;
      input.value = 'bot-trap';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.route('**/api/bilan-gratuit', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Bot detected' }),
      });
    });

    await page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i }).click();
    await expect(page.getByText(/bot detected|erreur/i).first()).toBeVisible();

    await page.unroute('**/api/bilan-gratuit');
    await page.route('**/api/bilan-gratuit', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    await page.goto('/bilan-gratuit', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Prénom du parent', { exact: true }).fill('Sara');
    await page.getByLabel('Nom du parent', { exact: true }).fill('Ben Ali');
    await page.getByLabel('Email', { exact: true }).fill(`sara.${Date.now()}@example.com`);
    await page.locator('#parentPhone').fill('+216 99 19 28 29');
    await page.getByLabel('Prénom de l’élève', { exact: true }).fill('Amine');
    await page.getByLabel('Classe', { exact: true }).selectOption('premiere');
    await page.getByLabel('Établissement', { exact: true }).fill('Lycée français');
    await page.getByLabel('Mathématiques', { exact: true }).check();
    await page.getByLabel('Besoin principal', { exact: true }).fill('Préparer une remise à niveau avant la rentrée.');
    await page.getByLabel('Message libre', { exact: true }).fill('Besoin d’un échange pédagogique pour clarifier les priorités.');
    await page.getByLabel(/j’accepte d’être contacté/i).check();
    await page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i }).click();
    await expect(page.getByText(/server error|erreur/i).first()).toBeVisible();
  });

  test('/offres and contact pages expose the expected business information', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });

    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /offres/i }).first()).toBeVisible();
    await expect(page.getByText('Catalogue 2026/2027', { exact: true })).toBeVisible();
    await expect(page.getByText(/groupes de 5 maximum/i)).toBeVisible();

    await page.goto('/stages', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/les dates précises sont communiquées selon le niveau, l’établissement et la formule recommandée/i)).toBeVisible();
    await expect(page.getByText(/printemps 2026|20 avril|1er mai|8 juin/i)).toHaveCount(0);

    await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('main').getByText(/siège social administratif/i).first()).toBeVisible();
    await expect(page.getByRole('main').getByText(/centre d’accompagnement pédagogique/i).first()).toBeVisible();
    await expect(page.getByRole('main').getByText(/mutuelleville, tunis/i).first()).toBeVisible();
    await expect(page.getByRole('main').getByText(/centre urbain nord, immeuble venus/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /whatsapp/i }).first()).toHaveAttribute('href', /wa\.me\/21699192829/);
    await expect(page.getByRole('link', { name: /appeler/i }).first()).toHaveAttribute('href', 'tel:+21699192829');
  });
});
