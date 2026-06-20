import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAsUser } from '../helpers/auth';

/**
 * Axe spot-check on authenticated dashboard routes.
 * Validates that the gray remap removal did not introduce
 * dark-on-dark contrast regressions.
 */

test.describe('Axe dashboards (authenticated)', () => {
  test('dashboard parent — 0 axe violation', async ({ page }) => {
    await loginAsUser(page, 'parent');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const results = await new AxeBuilder({ page }).analyze();

    if (results.violations.length > 0) {
      const summary = results.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} nodes]`
      );
      console.log('Violations parent dashboard:', summary);
      for (const v of results.violations) {
        for (const node of v.nodes) {
          console.log(`  [${v.id}] ${node.html.substring(0, 120)} | target: ${node.target}`);
        }
      }
    }
    expect(results.violations).toEqual([]);
  });

  test('dashboard eleve — 0 axe violation', async ({ page }) => {
    await loginAsUser(page, 'student');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const results = await new AxeBuilder({ page }).analyze();

    if (results.violations.length > 0) {
      const summary = results.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} nodes]`
      );
      console.log('Violations eleve dashboard:', summary);
      for (const v of results.violations) {
        for (const node of v.nodes) {
          console.log(`  [${v.id}] ${node.html.substring(0, 150)} | target: ${node.target}`);
        }
      }
    }
    expect(results.violations).toEqual([]);
  });

  test('dashboard admin — modale/dropdown ouverte — 0 axe violation', async ({ page }) => {
    await loginAsUser(page, 'admin');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // First: axe on the dashboard page itself
    const pageResults = await new AxeBuilder({ page }).analyze();
    if (pageResults.violations.length > 0) {
      const summary = pageResults.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} nodes]`
      );
      console.log('Violations admin dashboard (page):', summary);
      for (const v of pageResults.violations) {
        for (const node of v.nodes) {
          console.log(`  [${v.id}] ${node.html.substring(0, 150)} | target: ${node.target}`);
        }
      }
    }
    expect(pageResults.violations).toEqual([]);

    // Try to open a dropdown/modal — look for common interactive elements
    const dropdownTrigger = page.locator(
      'button[aria-haspopup], [role="combobox"], [data-radix-collection-item], button:has-text("Filtrer"), button:has-text("Actions")'
    ).first();

    const hasTrigger = await dropdownTrigger.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTrigger) {
      await dropdownTrigger.click();

      // Wait for the dropdown/popup to actually open before scanning
      const dropdownPanel = page.locator(
        '[role="menu"], [role="listbox"], [data-state="open"], [role="dialog"]'
      ).first();
      const panelOpened = await dropdownPanel.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);

      if (panelOpened) {
        const modalResults = await new AxeBuilder({ page }).analyze();
        if (modalResults.violations.length > 0) {
          const summary = modalResults.violations.map(
            (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} nodes]`
          );
          console.log('Violations admin dashboard (dropdown open):', summary);
        }
        expect(modalResults.violations).toEqual([]);
      }
    }
  });
});
