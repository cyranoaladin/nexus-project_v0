import { test, expect } from '@playwright/test';

/**
 * SEO & Meta Tags — E2E Contract Tests
 *
 * Verifies that critical pages have proper meta tags for SEO.
 */

const SEO_PAGES = [
  { path: '/', titleContains: 'Nexus' },
  { path: '/offres', titleContains: 'offre' },
  { path: '/contact', titleContains: 'contact' },
  { path: '/bilan-gratuit', titleContains: 'bilan' },
  { path: '/stages/fevrier-2026', titleContains: 'stage' },
  { path: '/auth/signin', titleContains: 'connexion' },
];

test.describe('SEO & Meta tags', () => {
  for (const { path, titleContains } of SEO_PAGES) {
    test(`${path} has proper title`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const title = await page.title();
      expect(title.toLowerCase()).toContain(titleContains.toLowerCase());
    });
  }

  test('homepage has meta description', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const metaDesc = page.locator('meta[name="description"]');
    const content = await metaDesc.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(20);
  });

  test('homepage has Open Graph tags', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
  });

  test('pages have lang attribute on html', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('pages have viewport meta tag', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });
});
