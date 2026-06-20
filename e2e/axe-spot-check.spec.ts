import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicPages = [
  '/',
  '/offres',
  '/bilan-gratuit',
  '/accompagnement-scolaire',
  '/plateforme-aria',
  '/contact',
  '/notre-centre',
  '/equipe',
  '/stages',
  '/ressources',
  '/recommandation',
  '/mentions-legales',
  '/programme/maths-1ere',
];

for (const route of publicPages) {
  test(`axe spot-check: ${route} (desktop)`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test(`axe spot-check: ${route} (mobile)`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
