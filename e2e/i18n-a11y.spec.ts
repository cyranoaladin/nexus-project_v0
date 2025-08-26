import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('i18n and accessibility', () => {
  test('Switch locale and run an accessibility scan on a dashboard page', async ({
    page,
    browserName,
  }) => {
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    // Basculer locale si contrôles présents (tolérant)
    const localeSwitch = page.getByRole('button', { name: /fr-CA|fr-FR|Langue|Language/i }).first();
    if (await localeSwitch.count().then((c) => c > 0)) {
      await localeSwitch.click({ force: true }).catch(() => {});
    }

    // Audit Axe - ne fail que sur les critiques
    // Firefox peut ne pas avoir un <main> explicite selon la page; scanner tout le body
    const results = await new AxeBuilder({ page }).include('body').analyze();
    const critical = (results.violations || []).filter((v) =>
      ['critical'].includes((v.impact || '').toLowerCase())
    );
    expect(critical.length).toBe(0);
  });
});
