/**
 * Planning Studio — contrat d'interface verrouille.
 *
 * Ces scenarios figent des comportements d'interface obtenus lors de la passe
 * de finition. Ils ne decrivent pas une apparence — une capture le ferait mieux
 * — mais des proprietes qu'une regression casserait sans qu'aucun autre test ne
 * s'en apercoive : un nom accessible perdu, un compteur faux, une bande vide,
 * un panneau qui recouvre la barre.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

async function openPlanning(page: Page) {
  await page.goto('/planning', { waitUntil: 'networkidle' });
  await page.waitForSelector('#gridWrap', { timeout: 20_000 });
  await page.waitForTimeout(600);
}

test.describe('Planning Studio — noms accessibles des boutons reduits', () => {
  test('a 390 px, les boutons icone conservent leur nom accessible', async ({ page }) => {
    // Annuler, Retablir et Panneau perdent leur libelle visible sous 520 px.
    // Le texte n'est pas supprime mais rendu invisible a l'oeil seul : s'il
    // etait retire du DOM, ces boutons deviendraient anonymes pour un lecteur
    // d'ecran alors qu'ils restent les commandes principales.
    await loginAsUser(page, 'admin');
    await page.setViewportSize({ width: 390, height: 844 });
    await openPlanning(page);

    for (const name of [/Annuler/i, /Rétablir/i, /Panneau/i]) {
      const button = page.getByRole('button', { name });
      expect(await button.count(), `bouton ${String(name)} expose par son nom`).toBeGreaterThan(0);
      await expect(button.first()).toBeVisible();
    }
  });
});

test.describe('Planning Studio — filtres replies', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'admin');
    await page.setViewportSize({ width: 1280, height: 800 });
    await openPlanning(page);
  });

  test('le compteur suit exactement les dimensions actives, sans double comptage', async ({ page }) => {
    // Aucun filtre : ni compteur, ni resume.
    await expect(page.locator('#filterCount')).toBeHidden();
    await expect(page.locator('#filterSummary')).toBeHidden();

    await page.click('#btnFilters');
    await page.waitForTimeout(200);

    // Une dimension.
    await page.selectOption('#filterLevel', 'TERMINALE');
    await page.waitForTimeout(250);
    await expect(page.locator('#filterCount')).toHaveText('1');

    // Trois dimensions distinctes — le meme filtre modifie deux fois ne compte
    // qu'une seule fois, ce qui est precisement le double comptage a interdire.
    await page.selectOption('#filterLevel', 'PREMIERE');
    await page.selectOption('#filterDay', 'SAT');
    await page.click('#filterConflicts');
    await page.waitForTimeout(300);
    await expect(page.locator('#filterCount')).toHaveText('3');

    // Le resume reste lisible : il nomme les trois dimensions.
    await page.click('#btnFilters');
    await page.waitForTimeout(200);
    const summary = (await page.textContent('#filterSummaryText')) ?? '';
    expect(summary.length, 'le resume nomme les filtres actifs').toBeGreaterThan(0);
    expect(summary.split('·').length, 'une mention par dimension active').toBe(3);

    // Effacer remet tout a zero depuis le resume, sans rouvrir le panneau.
    await page.click('#filterClearInline');
    await page.waitForTimeout(300);
    await expect(page.locator('#filterCount')).toBeHidden();
    await expect(page.locator('#filterSummary')).toBeHidden();
  });
});

test.describe('Planning Studio — hauteur de barre et regime des filtres', () => {
  // `--toolbar-h` reserve la hauteur de la barre ET sert de decalage collant.
  // Figee, elle laissait une bande vide sous une barre repliee ; suivie sans
  // precaution, elle ferait recouvrir la grille quand les filtres s'ouvrent.
  for (const [name, width] of [['1599 (filtres replies)', 1599], ['1600 (filtres deployes)', 1600]] as const) {
    test(`a ${name}, la barre et la grille restent jointives`, async ({ page }) => {
      await loginAsUser(page, 'admin');
      await page.setViewportSize({ width, height: 900 });
      await openPlanning(page);

      const collapsed = width < 1600;
      await expect(page.locator('#btnFilters')).toBeVisible({ visible: collapsed });

      const gap = await page.evaluate(() => {
        const toolbar = document.querySelector('.toolbar') as HTMLElement | null;
        const planning = document.querySelector('.planning') as HTMLElement | null;
        if (!toolbar || !planning) return null;
        const t = toolbar.getBoundingClientRect();
        const p = planning.getBoundingClientRect();
        return { gap: p.top - t.bottom, toolbarHeight: t.height };
      });
      expect(gap, 'barre et planning mesures').not.toBeNull();
      // Aucune bande vide, et aucun recouvrement : les deux se touchent.
      expect(gap!.gap, 'pas de bande vide sous la barre').toBeLessThanOrEqual(1);
      expect(gap!.gap, 'pas de recouvrement de la grille').toBeGreaterThanOrEqual(-1);
    });
  }
});

test.describe('Planning Studio — panneau en surimpression', () => {
  for (const [name, width, height] of [
    ['1440x900', 1440, 900], ['1280x800', 1280, 800],
    ['1024x768', 1024, 768], ['768x1024', 768, 1024],
  ] as const) {
    test(`${name} : panneau ouvert, la barre reste utilisable`, async ({ page }) => {
      await loginAsUser(page, 'admin');
      await page.setViewportSize({ width, height });
      await openPlanning(page);
      await page.locator('.card').first().click();
      await page.waitForSelector('#side');
      await page.waitForTimeout(350);

      // `trial` echoue si un autre element intercepte le pointeur : c'est le
      // recouvrement que l'on veut interdire, et non la seule visibilite.
      for (const id of ['btnFilters', 'btnMore', 'btnNewSession']) {
        const control = page.locator(`#${id}`);
        if (await control.count() === 0) continue;
        if (!(await control.isVisible())) continue;
        await control.click({ trial: true, timeout: 3000 });
      }

      // Le voile commence SOUS la barre : il ne doit jamais la couvrir.
      const bounds = await page.evaluate(() => {
        const scrim = document.querySelector('.side-scrim') as HTMLElement | null;
        const toolbar = document.querySelector('.toolbar') as HTMLElement | null;
        if (!scrim || !toolbar) return null;
        if (getComputedStyle(scrim).display === 'none') return { scrimTop: null, toolbarBottom: toolbar.getBoundingClientRect().bottom };
        return { scrimTop: scrim.getBoundingClientRect().top, toolbarBottom: toolbar.getBoundingClientRect().bottom };
      });
      expect(bounds).not.toBeNull();
      if (bounds!.scrimTop !== null) {
        expect(bounds!.scrimTop, 'le voile commence sous la barre').toBeGreaterThanOrEqual(bounds!.toolbarBottom - 1);
      }
    });
  }
});

test.describe('Planning Studio — texte essentiel non tronque', () => {
  for (const [name, width, height] of [
    ['1920', 1920, 1080], ['1440', 1440, 900], ['1280', 1280, 800], ['390', 390, 844],
  ] as const) {
    test(`${name} : aucun texte essentiel rogne`, async ({ page }) => {
      await loginAsUser(page, 'admin');
      await page.setViewportSize({ width, height });
      await openPlanning(page);

      const truncated = await page.evaluate(() => {
        const out: string[] = [];
        // Le texte ESSENTIEL est celui qui identifie la seance et les commandes.
        // Les metadonnees secondaires portent une ellipse assumee : elles sont
        // volontairement exclues, et leur contenu reste dans l'infobulle, le
        // panneau et la vue dediee.
        const essential = '.card-subject, .topbar .btn, .view-switch button, .planning-head h2, .kpi b';
        document.querySelectorAll(essential).forEach((el) => {
          const node = el as HTMLElement;
          if (!node.offsetWidth || !node.offsetHeight) return;
          if (node.scrollWidth > node.clientWidth + 1) out.push((node.textContent || '').trim().slice(0, 32));
        });
        return out;
      });
      expect(truncated, 'TRUNCATED_ESSENTIAL_TEXT=0').toEqual([]);
    });
  }
});

test.describe('Planning Studio — salle exceptionnelle et historique restent atteignables', () => {
  test('la salle exceptionnelle reste visible en configuration et en charge', async ({ page }) => {
    // Elle n'ouvre pas de couloir dans la vue Salles tant qu'aucune seance
    // ACTIVE ne l'occupe — c'est voulu, une colonne vide sur sept jours serait
    // du bruit. Sa visibilite ne doit pas pour autant se perdre ailleurs.
    await loginAsUser(page, 'admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlanning(page);

    await page.click('#btnMore');
    await page.click('#btnSettings');
    await page.waitForSelector('.modal-tabs');
    await page.locator('.modal-tabs button', { hasText: 'Salles' }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('.modal-root')).toContainText('Salle 3');

    await page.locator('.modal-root button', { hasText: 'Fermer' }).last().click();
    await page.waitForTimeout(300);

    await page.locator('.card').first().click();
    await page.waitForTimeout(300);
    await page.click('#tabStats');
    await page.waitForTimeout(500);
    await expect(page.locator('#sideBody')).toContainText('Salle 3');
  });

  test('Configuration mene explicitement a l’Historique des revisions', async ({ page }) => {
    await loginAsUser(page, 'admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlanning(page);

    await page.click('#btnMore');
    await page.click('#btnSettings');
    await page.waitForSelector('.modal-tabs');
    const history = page.locator('.modal-tabs button', { hasText: 'Historique' });
    expect(await history.count(), 'l’onglet Historique est offert a un ADMIN').toBe(1);
    await history.click();
    await page.waitForTimeout(700);
    await expect(page.locator('.modal-root')).toContainText('Historique des révisions');
  });
});

test.describe('Planning Studio — densite compacte', () => {
  test('a 1440x900, la journee entiere et la legende tiennent sans defiler', async ({ page }) => {
    // C'est la raison d'etre du mode Compact : une vue de controle. S'il ne
    // tenait plus, il ne se distinguerait plus de Confort par autre chose
    // qu'une police plus petite.
    await loginAsUser(page, 'admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlanning(page);
    await page.locator('#densitySwitch button[data-value="compact"]').click();
    await page.waitForTimeout(600);

    const fits = await page.evaluate(() => {
      const wrap = document.getElementById('gridWrap');
      const legend = document.getElementById('legend');
      if (!wrap || !legend) return null;
      return {
        gridScrolls: wrap.scrollHeight > wrap.clientHeight + 2,
        legendVisible: legend.getBoundingClientRect().bottom <= window.innerHeight + 1,
      };
    });
    expect(fits).not.toBeNull();
    expect(fits!.gridScrolls, 'la grille ne defile pas verticalement en compact').toBe(false);
    expect(fits!.legendVisible, 'la legende reste dans la fenetre').toBe(true);
  });
});
