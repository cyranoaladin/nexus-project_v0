import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import { loginAs } from './helpers';

test.setTimeout(120000);
test('crawl buttons & links on key pages', async ({ page }) => {
  const routes = JSON.parse(await fs.readFile('tests/e2e/routes.map.json', 'utf-8')) as Array<{path:string, requiredSelector:string, roles?: string[]}>;

  for (const route of routes) {
    const roles = route.roles || [];
    if (roles.includes('ADMIN')) {
      await loginAs(page, 'admin@nexus.com', 'password123');
    } else if (roles.includes('ELEVE')) {
      await loginAs(page, 'eleve.lucas.dupont@nexus.com');
    }
    await page.goto(route.path, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Cette page est en cours de construction\\./')).not.toBeVisible();
    await expect(page.locator(route.requiredSelector).first()).toBeVisible();

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

        const urlBefore = page.url();
        // Utiliser un clic d'essai pour éviter les navigations destructives lors du crawl
        await el.click({ trial: true }).catch(() => {});
        // Stabiliser si une action a quand même déclenché une navigation
        try {
          await page.waitForLoadState('networkidle', { timeout: 500 });
        } catch {}
        if (!page.url().includes(route.path)) {
          await page.goto(route.path, { waitUntil: 'networkidle' }).catch(() => {});
        }
      } catch {
        // ignorer éléments instables/détachés
      }
    }

    // Stabiliser avant de passer à la route suivante
    try { await page.waitForLoadState('networkidle', { timeout: 1000 }); } catch {}
  }
});

