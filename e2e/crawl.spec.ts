import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import { loginAs } from './helpers';

test.setTimeout(120000);
test('crawl buttons & links on key pages', async ({ page }) => {
  const routes = JSON.parse(await fs.readFile('tests/e2e/routes.map.json', 'utf-8')) as Array<{path:string, requiredSelector:string, roles?: string[]}>;

  // Connexion si route nécessite un rôle
  const needsAuth = routes.some(r => (r.roles||[]).some(role => role !== 'PUBLIC'));
  if (needsAuth) {
    await loginAs(page, 'admin@nexus.com', 'password123');
  }

  for (const route of routes) {
    await page.goto(route.path, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Cette page est en cours de construction\\./')).not.toBeVisible();
    await expect(page.locator(route.requiredSelector)).toBeVisible();
    const clickables = page.locator('a:visible, button:visible, [role="button"]:visible, [data-testid]:visible');
    const count = Math.min(await clickables.count(), 10);
    for (let i = 0; i < count; i++) {
      const el = clickables.nth(i);
      try {
        await el.waitFor({ state: 'visible', timeout: 1000 });
        const href = await el.getAttribute('href');
        const target = await el.getAttribute('target');
        if (href && /^https?:\/\//i.test(href)) continue;
        if (target === '_blank') continue;
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await el.click({ trial: false }).catch(() => {});
      } catch {
        // ignorer éléments instables/détachés
      }
    }
  }
});


