/**
 * Planning Studio — géométrie responsive, mesurée sur l'application réelle.
 *
 * Pas de capture d'écran de référence au pixel près : une variation de police
 * suffirait à rendre la CI rouge sans qu'aucun défaut n'existe. Les assertions
 * portent sur la géométrie — ce qui déborde, ce qui est atteignable, ce qui
 * est rogné — et une capture n'est conservée qu'en cas d'échec, comme
 * diagnostic.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1440', width: 1440, height: 900 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'tablette-1024', width: 1024, height: 768 },
  { name: 'tablette-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
] as const;

/** Actions dont la perte rendrait le planning inutilisable. */
const ESSENTIAL_ACTIONS = ['btnUndo', 'btnRedo', 'btnNewSession', 'btnMore'];

/** Actions secondaires : atteignables via le menu, jamais derrière un scroll muet. */
const MENU_ACTIONS = ['btnPrint', 'btnExportCsv', 'btnExportJson', 'btnImport', 'btnReset'];

async function openPlanning(page: Page) {
  await page.goto('/planning', { waitUntil: 'networkidle' });
  await page.waitForSelector('#gridWrap', { timeout: 20_000 });
  await page.waitForTimeout(800);
}

test.describe('Planning Studio — géométrie responsive', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'admin');
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} : aucun débordement, actions atteignables`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openPlanning(page);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        await testInfo.attach(`overflow-${viewport.name}.png`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
      expect(overflow.scrollWidth, 'aucun défilement horizontal du document').toBeLessThanOrEqual(
        overflow.clientWidth + 1,
      );

      for (const id of ESSENTIAL_ACTIONS) {
        const box = await page.locator(`#${id}`).boundingBox();
        expect(box, `action essentielle #${id} présente`).not.toBeNull();
        expect(box!.x, `#${id} à gauche du bord`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `#${id} dans le viewport`).toBeLessThanOrEqual(viewport.width + 1);
      }

      // Les actions secondaires vivent dans le menu : elles doivent être
      // atteignables, pas visibles en permanence.
      await page.click('#btnMore');
      await page.waitForTimeout(250);
      expect(await page.getAttribute('#btnMore', 'aria-expanded')).toBe('true');
      for (const id of MENU_ACTIONS) {
        const box = await page.locator(`#${id}`).boundingBox();
        expect(box, `action secondaire #${id} atteignable via le menu`).not.toBeNull();
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      await page.keyboard.press('Escape');
      expect(await page.getAttribute('#btnMore', 'aria-expanded')).toBe('false');
    });
  }

  for (const viewport of VIEWPORTS.filter((v) => v.width >= 1024)) {
    test(`${viewport.name} : le week-end reste atteignable panneau ouvert`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openPlanning(page);
      await page.evaluate(() => {
        document.body.classList.add('side-open');
        document.body.classList.remove('side-collapsed');
      });
      await page.waitForTimeout(350);

      const weekend = await page.evaluate(() => {
        const text = document.body.innerText;
        const wrap = document.getElementById('gridWrap');
        return {
          saturday: /Samedi|Sam\b/.test(text),
          sunday: /Dimanche|Dim\b/.test(text),
          gridScrollable: wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : false,
        };
      });

      if (!weekend.saturday || !weekend.sunday) {
        await testInfo.attach(`weekend-${viewport.name}.png`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
      // Samedi et dimanche portent toutes les séances scolarisées de Première
      // et Terminale : les perdre viderait le planning de sa substance.
      expect(weekend.saturday, 'samedi présent').toBe(true);
      expect(weekend.sunday, 'dimanche présent').toBe(true);
    });
  }

  test('mobile 390 : sélecteur de jour visible et cartes lisibles', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPlanning(page);

    const days = page.locator('#mobileDays button');
    expect(await days.count(), 'sept jours sélectionnables').toBe(7);
    expect(await days.first().isVisible()).toBe(true);

    const clipped = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('.card *').forEach((el) => {
        const style = getComputedStyle(el as HTMLElement);
        if (style.position === 'absolute' && (el as HTMLElement).offsetWidth <= 1) return; // libellés lecteurs d'écran
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push((el.textContent || '').trim().slice(0, 24));
      });
      return out;
    });
    expect(clipped, 'aucun texte de carte rogné sur mobile').toEqual([]);
  });

  test('mobile ≤520px : topbar sticky au défilement et menu More atteignable (contre-preuve)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPlanning(page);

    // 0. Réinitialiser la position de défilement au sommet
    await page.evaluate(() => window.scrollTo(0, 0));

    // 0bis. Vérification de layout au repos (REST_LAYOUT_NO_OVERLAP=PASS)
    const topbarBoxRest = await page.locator('.topbar').boundingBox();
    expect(topbarBoxRest, 'topbar présente au repos').not.toBeNull();
    expect(topbarBoxRest!.y, 'topbar collée en haut au repos').toBeCloseTo(0, 1);

    const toolbarBoxRest = await page.locator('.toolbar').boundingBox();
    if (toolbarBoxRest) {
      expect(toolbarBoxRest.y, 'toolbar sous la topbar au repos').toBeGreaterThanOrEqual(
        topbarBoxRest!.y + topbarBoxRest!.height - 1,
      );
    }

    // 1. Mesurer le défilement vertical du document (fail closed si le document n'est pas scrollable)
    const scrollInfo = await page.evaluate(() => {
      const doc = document.scrollingElement || document.documentElement;
      const scrollHeight = doc.scrollHeight;
      const clientHeight = window.innerHeight;
      const docScrollable = scrollHeight > clientHeight;
      return {
        docScrollable,
        scrollHeight,
        clientHeight,
        initialScrollY: window.scrollY,
      };
    });

    const DOC_SCROLLABLE = scrollInfo.docScrollable ? 'YES' : 'NO';
    expect(DOC_SCROLLABLE, 'DOC_SCROLLABLE=YES: le document entier doit être scrollable').toBe('YES');
    expect(scrollInfo.initialScrollY, 'scroll initial à 0').toBe(0);

    // 2. Faire défiler réellement le document
    const scrollAmount = 250;
    await page.evaluate((amount) => {
      window.scrollBy(0, amount);
    }, scrollAmount);
    await page.waitForTimeout(200);

    // 3. Vérifier que window.scrollY a augmenté (REAL_DOCUMENT_SCROLL_EXERCISED=YES)
    const scrolledY = await page.evaluate(() => window.scrollY);
    const REAL_DOCUMENT_SCROLL_EXERCISED = scrolledY > scrollInfo.initialScrollY ? 'YES' : 'NO';
    expect(REAL_DOCUMENT_SCROLL_EXERCISED, 'REAL_DOCUMENT_SCROLL_EXERCISED=YES: window.scrollY a augmenté après défilement').toBe('YES');
    expect(scrolledY).toBeGreaterThan(0);

    // 4. Vérifier que la topbar reste visible et collée en haut (MOBILE_TOPBAR_STICKY_RUNTIME=YES)
    const topbarBox = await page.locator('.topbar').boundingBox();
    expect(topbarBox, 'topbar présente pendant le scroll').not.toBeNull();
    const MOBILE_TOPBAR_STICKY_RUNTIME = Math.abs(topbarBox!.y) <= 1.5 ? 'YES' : 'NO';
    expect(MOBILE_TOPBAR_STICKY_RUNTIME, 'MOBILE_TOPBAR_STICKY_RUNTIME=YES: topbar collée en haut (sticky) pendant le scroll').toBe('YES');

    // 5 & 6. Ouvrir le menu More pendant l'état scrollé (MOBILE_MORE_MENU_REACHABLE_DURING_SCROLL=YES)
    await page.click('#btnMore');
    await page.waitForTimeout(250);
    expect(await page.getAttribute('#btnMore', 'aria-expanded')).toBe('true');

    // 7. Vérifier toutes les actions secondaires dans le viewport
    for (const id of MENU_ACTIONS) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box, `action secondaire #${id} visible et dans le viewport`).not.toBeNull();
      expect(box!.x, `#${id} à l'intérieur du bord gauche`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `#${id} à l'intérieur du bord droit`).toBeLessThanOrEqual(390 + 1);
      expect(box!.y, `#${id} sous la topbar`).toBeGreaterThanOrEqual(topbarBox!.y);
      expect(box!.y + box!.height, `#${id} visible dans la hauteur du viewport`).toBeLessThanOrEqual(844 + 1);
    }

    // 8. Fermer le menu More
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await page.getAttribute('#btnMore', 'aria-expanded')).toBe('false');

    // 9. Géométrie toolbar en état scrollé (SCROLLED_LAYOUT_NO_INTERACTIVE_OVERLAP=PASS)
    const toolbarBox = await page.locator('.toolbar').boundingBox();
    if (toolbarBox) {
      const isAboveTopbar = toolbarBox.y + toolbarBox.height <= topbarBox!.y + 1;
      const isBelowTopbar = toolbarBox.y >= topbarBox!.y + topbarBox!.height - 1;
      expect(isAboveTopbar || isBelowTopbar, 'SCROLLED_LAYOUT_NO_INTERACTIVE_OVERLAP=PASS: pas de chevauchement toolbar/topbar').toBe(true);
    }
  });

  test('aucune erreur navigateur ni requête en échec sur le parcours responsive', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      // auth.js sonde /api/auth/session en continu. Quand ce fetch est annule
      // — redimensionnement, fin de test, fermeture du contexte — son `catch`
      // journalise « Failed to fetch ». C'est l'echo cote client d'une requete
      // deja classee comme ANNULEE ci-dessous, pas un defaut de la page. Seule
      // cette signature exacte est ecartee : toute autre erreur console, toute
      // exception non capturee et tout statut 4xx/5xx font echouer le test.
      if (/authjs\.dev#autherror/.test(text) && /Failed to fetch/.test(text)) return;
      errors.push(`console: ${text}`);
    });
    page.on('requestfailed', (r) => {
      // Une requete ANNULEE n'est pas une erreur : le sondage de session
      // d'auth.js peut etre interrompu par un redimensionnement ou la fin du
      // test. On ne masque que l'annulation, jamais un echec reseau reel.
      const reason = r.failure()?.errorText ?? '';
      if (/ERR_ABORTED|net::ERR_FAILED.*aborted/i.test(reason)) return;
      errors.push(`requestfailed: ${r.url()} (${reason})`);
    });
    page.on('response', (r) => {
      if (r.status() >= 500) errors.push(`http ${r.status()}: ${r.url()}`);
      if (r.status() === 404) errors.push(`http 404: ${r.url()}`);
    });

    await openPlanning(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // Attendre la stabilisation du reseau APRES chaque redimensionnement,
      // et non seulement a la fin : enchainer six changements sans laisser le
      // sondage de session d'auth.js se terminer l'interrompait, et son echo
      // console ressemblait a une erreur applicative alors qu'il n'en est pas
      // une. On supprime la cause plutot que de filtrer le symptome.
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
    }

    expect(errors).toEqual([]);
  });
});

test.describe('Planning Studio — géométrie verrouillée', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'admin');
  });

  test('mobile 390 : le menu d’actions reste borné dans la fenêtre', async ({ page }) => {
    // Ce test fige une regression constatee en integration et pas en local : le
    // menu etait ancre sur son BOUTON avec une largeur minimale, si bien que sa
    // position dependait des metriques de police. Sur le runner, plus larges, il
    // depassait de 8 px et faisait defiler le document horizontalement.
    await page.setViewportSize({ width: 390, height: 844 });
    await openPlanning(page);
    await page.click('#btnMore');
    await page.waitForSelector('#moreMenu:not([hidden])');

    const box = await page.locator('#moreMenu').boundingBox();
    expect(box, 'le menu est rendu').not.toBeNull();
    expect(box!.x, 'le menu ne sort pas par la gauche').toBeGreaterThanOrEqual(8);
    expect(box!.x + box!.width, 'le menu ne sort pas par la droite').toBeLessThanOrEqual(390 - 8 + 0.5);

    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(doc.scrollWidth, 'menu ouvert, le document ne défile pas').toBeLessThanOrEqual(doc.clientWidth + 1);
  });

  test('les commandes de la barre restent atteignables panneau ouvert', async ({ page }) => {
    // Sous 1600 px le panneau est en surimpression. Ancre trop haut, il
    // recouvrait le coin droit de la barre d'outils : filtres et densite
    // devenaient inatteignables alors que le voile epargnait deja cette zone.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlanning(page);
    await page.locator('.card').first().click();
    await page.waitForSelector('#side');
    await page.waitForTimeout(350);

    for (const id of ['btnFilters', 'btnMore', 'btnNewSession']) {
      const visible = await page.locator(`#${id}`).isVisible();
      expect(visible, `#${id} visible panneau ouvert`).toBe(true);
      // `click` echoue si un autre element intercepte le pointeur : c'est
      // exactement le recouvrement que l'on veut interdire.
      await page.locator(`#${id}`).click({ trial: true, timeout: 3000 });
    }
  });

  for (const [name, width, height] of [['1440', 1152, 720], ['1280', 1024, 640]] as const) {
    test(`zoom navigateur 125 % depuis ${name} : aucun débordement`, async ({ page }) => {
      // Un zoom de 125 % divise la fenetre CSS par 1,25 : 1440 devient 1152 et
      // 1280 devient 1024. On reproduit donc la fenetre effective plutot que de
      // manipuler un `zoom` non standard, dont le rendu differe du vrai zoom.
      await page.setViewportSize({ width, height });
      await openPlanning(page);

      const doc = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(doc.scrollWidth, 'aucun défilement horizontal à 125 %').toBeLessThanOrEqual(doc.clientWidth + 1);

      for (const id of ['btnUndo', 'btnRedo', 'btnNewSession', 'btnMore', 'btnFilters']) {
        const box = await page.locator(`#${id}`).boundingBox();
        expect(box, `#${id} présent à 125 %`).not.toBeNull();
        expect(box!.x + box!.width, `#${id} dans la fenêtre à 125 %`).toBeLessThanOrEqual(width + 1);
      }
    });
  }
});
