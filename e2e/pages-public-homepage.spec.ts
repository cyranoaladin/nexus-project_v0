import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CAMPAIGN_PATH = '/stages/pre-rentree-2026';

test.describe('Homepage (/) - Landing Nexus Reussite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page charge sans erreurs console critiques', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const critical = errors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('404') &&
        !error.includes('hydration') &&
        !error.includes('Warning') &&
        !error.includes('Failed to load resource') &&
        !error.includes('net::ERR_') &&
        !error.includes('NEXT_REDIRECT') &&
        !error.includes('ClientFetchError') &&
        !error.includes('authjs')
    );

    expect(critical, `Erreurs console critiques: ${critical.join(', ')}`).toHaveLength(0);
  });

  test('H1 est visible et contient le texte exact', async ({ page }) => {
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Préparer le bac français avec méthode, suivi et exigence.');
  });

  test('hero CTA principal pointe vers /recommandation', async ({ page }) => {
    await expect(page.locator('section a[href="/recommandation"]').first()).toBeVisible();
  });

  test('hero CTA secondaire pointe vers /offres', async ({ page }) => {
    await expect(page.locator('section a[href="/offres"]').first()).toBeVisible();
  });

  test('conserve les neuf sections institutionnelles sans promotion expirée', async ({ page }) => {
    const sections = page.locator('main > section');
    await expect(sections).toHaveCount(9);
    await expect(page.getByRole('region', { name: 'Campagne Pré-rentrée 2026' }))
      .toHaveCount(0);
  });

  test('2 WA links at load, 3 visible after scroll (+ bubble), MobileStickyBar in DOM but hidden', async ({ page }) => {
    // At load (desktop): hero WA + final CTA WA = 2 in DOM
    // FloatingAdvisorBubble hidden (hero visible), MobileStickyBar returns null
    const waLinks = page.locator('a[href*="wa.me"]');
    await expect(waLinks).toHaveCount(2);

    // Scroll past hero → bubble + MobileStickyBar render (4 DOM, 3 visible)
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForTimeout(800);

    // 4 in DOM: hero + CTA + bubble + MobileStickyBar(md:hidden)
    await expect(waLinks).toHaveCount(4);

    // Only 3 visible (MobileStickyBar hidden at desktop)
    const visibleCount = await waLinks.evaluateAll((els) =>
      els.filter((el) => {
        const cs = getComputedStyle(el);
        return el instanceof HTMLElement && cs.display !== 'none' && el.offsetWidth > 0;
      }).length
    );
    expect(visibleCount).toBe(3);
  });

  test('tous les liens footer internes ne retournent pas 404', async ({ page }) => {
    const footerLinks = page.locator('footer a[href^="/"]');
    const count = await footerLinks.count();

    for (let index = 0; index < Math.min(count, 15); index += 1) {
      const href = await footerLinks.nth(index).getAttribute('href');
      if (href) {
        const response = await page.request.get(href);
        expect(response.status(), `Footer link ${href} returned ${response.status()}`).not.toBe(404);
      }
    }
  });

  test('images landing ont des alt texts', async ({ page }) => {
    const landingImages = page.locator('img[alt]');
    const count = await landingImages.count();

    expect(count).toBeGreaterThanOrEqual(1);

    for (let index = 0; index < count; index += 1) {
      const alt = await landingImages.nth(index).getAttribute('alt');
      expect(alt, `Image ${index} has empty alt`).toBeTruthy();
    }
  });

  test('garde le hero institutionnel visible sur mobile sans débordement', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('[data-hero] h1')).toBeVisible();
      await expect(page.locator('[data-hero] a[href="/recommandation"]')).toBeVisible();
      await expect(page.getByTestId('pre-rentree-home-spotlight')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test('retire tous les liens et entrées de navigation de la campagne expirée', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await expect(page.locator(`a[href^="${CAMPAIGN_PATH}"]`)).toHaveCount(0);
    await expect(page.getByTestId('pre-rentree-nav-desktop')).toHaveCount(0);

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/');
    await expect(page.getByTestId('pre-rentree-nav-mobile')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu principal' });
    await expect(menu.locator(`a[href^="${CAMPAIGN_PATH}"]`)).toHaveCount(0);
    await expect(menu.getByRole('link', { name: /Se connecter/i })).toHaveAttribute('href', '/auth/signin');
  });

  test('n’émet aucun événement analytics de campagne après le retrait du bandeau', async ({ page }) => {
    await page.addInitScript(() => {
      const analyticsWindow = window as unknown as {
        gtag: (...args: unknown[]) => void;
        __campaignEvents: unknown[][];
      };
      analyticsWindow.__campaignEvents = [];
      Object.defineProperty(analyticsWindow, 'gtag', {
        configurable: false,
        writable: false,
        value: (...args: unknown[]) => analyticsWindow.__campaignEvents.push(args),
      });
    });
    await page.goto('/?campaign-analytics-test=closed');
    await expect(page.getByTestId('pre-rentree-home-spotlight')).toHaveCount(0);

    const events = await page.evaluate(() => (window as unknown as { __campaignEvents: unknown[][] }).__campaignEvents);
    expect(events.filter((event) => String(event[1] ?? '').startsWith('pre_rentree_'))).toEqual([]);
    expect(JSON.stringify(events)).not.toMatch(/email|phone|telephone|school|user_id|parent_id|student_id/i);
  });

  test('reste accessible au clavier, avec Axe et au zoom 200 % sans la campagne', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 720, height: 500 });
    await page.goto('/');
    const primary = page.locator('section a[href="/recommandation"]').first();
    await primary.focus();
    await expect(primary).toBeFocused();

    const results = await new AxeBuilder({ page }).include('main').analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    await expect(primary).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('conserve le routeur permanent avec Troisième et Candidat libre', async ({ page }) => {
    const router = page.getByText('Mon enfant est en…').locator('..');
    await expect(router.getByRole('link', { name: /Troisième/i })).toBeVisible();
    await expect(router.getByRole('link', { name: /Candidat libre/i })).toBeVisible();
  });
});
