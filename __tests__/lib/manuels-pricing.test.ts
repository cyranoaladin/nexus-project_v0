/**
 * Moteur de prix des manuels — confrontation au moteur de la Maison édition.
 *
 * Le jeu de référence (__tests__/lib/fixtures/manuels-prix-reference.json) est
 * ENGENDRÉ par work/offre/exporter_banc_essai.py depuis prix_v2.py, qui fait
 * autorité sur le barème v2. 186 cas × 3 formats = 558 prix. Le moteur du site
 * doit reproduire chacun au dinar près : un écart signifie que la page vend à
 * un prix que la grille tarifaire ne reconnaît pas.
 */
import {
  paperSupplement,
  priceForPages,
  quote,
  quoteForVolumeIds,
  savingForFormat,
  totalForFormat,
  unitTotalForFormat,
  type ManuelFormat,
} from '@/lib/manuels/pricing';
import { getManuelsBaremeClient, getManuelVolumesClient } from '@/lib/manuels/catalogue-client';
import reference from './fixtures/manuels-prix-reference.json';

type Cas = {
  type: string;
  label: string;
  ids: string[];
  volumes: number;
  pages: number;
  pdf: number;
  pdfUnites: number;
  nb: number;
  couleur: number;
};

const CAS = reference.cas as Cas[];
const BAREME = getManuelsBaremeClient();

describe('banc d’essai — 186 cas confrontés au moteur Python', () => {
  test('le jeu de référence est complet', () => {
    expect(CAS).toHaveLength(186);
    expect(CAS.filter((c) => c.type === 'unite')).toHaveLength(41);
    expect(CAS.filter((c) => c.type === 'lot')).toHaveLength(139);
  });

  test.each(CAS.map((c) => [`${c.type} · ${c.label}`, c] as const))(
    'aucun écart — %s',
    (_titre, c) => {
      const d = quoteForVolumeIds(c.ids);
      expect(d.pages).toBe(c.pages);
      expect(d.volumes).toBe(c.volumes);
      expect(d.pdf).toBe(c.pdf);
      expect(d.unit.pdf).toBe(c.pdfUnites);
      expect(d.bw).toBe(c.nb);
      expect(d.color).toBe(c.couleur);
    },
  );
});

describe('le barème lui-même', () => {
  test('douze pages ou moins : offert', () => {
    expect(priceForPages(0, BAREME)).toBe(0);
    expect(priceForPages(12, BAREME)).toBe(0);
  });

  test('au-delà de douze pages, le plancher de 15 DT s’applique', () => {
    expect(priceForPages(13, BAREME)).toBe(15);
    expect(priceForPages(44, BAREME)).toBe(15);
  });

  test('le prix ne décroît jamais quand les pages augmentent', () => {
    let precedent = 0;
    for (let p = 0; p <= 7200; p += 1) {
      const prix = priceForPages(p, BAREME);
      expect(prix).toBeGreaterThanOrEqual(precedent);
      precedent = prix;
    }
  });

  test('le supplément papier couleur dépasse toujours le noir et blanc', () => {
    for (const pages of [13, 71, 131, 200, 410, 675]) {
      expect(paperSupplement([pages], true, BAREME)).toBeGreaterThan(
        paperSupplement([pages], false, BAREME),
      );
    }
  });

  test('le groupage retire 1 DT par volume au-delà du cinquième', () => {
    const cinq = Array(5).fill(100);
    const six = Array(6).fill(100);
    const ecart =
      paperSupplement(six, false, BAREME) - paperSupplement(cinq, false, BAREME);
    expect(ecart).toBe(paperSupplement([100], false, BAREME) - 1);
  });
});

describe('invariants de vente', () => {
  const TOUS = getManuelVolumesClient();

  test('un lot n’est jamais plus cher que la somme de ses unités', () => {
    for (const c of CAS) {
      const d = quoteForVolumeIds(c.ids);
      expect(d.pdf).toBeLessThanOrEqual(d.unit.pdf);
    }
  });

  test('couleur > noir et blanc > PDF, pour tout panier non vide', () => {
    for (const c of CAS) {
      if (c.ids.length === 0) continue;
      const d = quoteForVolumeIds(c.ids);
      expect(d.color).toBeGreaterThan(d.bw);
      expect(d.bw).toBeGreaterThan(d.pdf);
    }
  });

  test('ajouter un volume ne fait jamais baisser le prix', () => {
    const base = ['pc-t', 'es-p', 'philosophie-t'];
    const avant = quoteForVolumeIds(base);
    for (const v of TOUS) {
      if (base.includes(v.id)) continue;
      const apres = quoteForVolumeIds([...base, v.id]);
      expect(apres.pdf).toBeGreaterThanOrEqual(avant.pdf);
      expect(apres.bw).toBeGreaterThanOrEqual(avant.bw);
      expect(apres.color).toBeGreaterThanOrEqual(avant.color);
    }
  });

  test('l’économie annoncée est exactement l’écart avec l’achat à l’unité', () => {
    const d = quoteForVolumeIds(TOUS.map((v) => v.id));
    expect(savingForFormat(d, 'pdf').tnd).toBe(d.unit.pdf - d.pdf);
    expect(savingForFormat(d, 'pdf').tnd).toBe(1784 - 586);
    expect(savingForFormat(d, 'pdf').pct).toBe(67);
  });

  test('l’économie est donnée pour le format choisi, pas seulement pour le PDF', () => {
    // Le groupage papier retire 1 DT par volume au-delà du cinquième : il fait
    // partie de la remise de lot, et l'afficher sous le seul angle numérique
    // sous-évaluerait ce que le client gagne sur une commande papier.
    const d = quoteForVolumeIds(TOUS.map((v) => v.id));
    for (const format of ['pdf', 'papier-nb', 'papier-couleur'] as ManuelFormat[]) {
      const eco = savingForFormat(d, format);
      expect(eco.tnd).toBe(unitTotalForFormat(d, format) - totalForFormat(d, format));
      expect(eco.tnd).toBeGreaterThan(0);
    }
    // 41 volumes : 36 dépassent le cinquième, donc au moins 36 DT de groupage
    // s'ajoutent à l'économie numérique. L'écart réel est un peu supérieur :
    // acheté volume par volume, chaque fabrication est arrondie au dinar
    // séparément, alors que le lot n'est arrondi qu'une fois.
    const ecart = savingForFormat(d, 'papier-nb').tnd - savingForFormat(d, 'pdf').tnd;
    expect(ecart).toBeGreaterThanOrEqual(36);
  });

  test('le total volume par volume est cohérent avec les prix unitaires', () => {
    const d = quoteForVolumeIds(['pc-t', 'es-p']);
    const seuls = [quoteForVolumeIds(['pc-t']), quoteForVolumeIds(['es-p'])];
    expect(unitTotalForFormat(d, 'papier-couleur')).toBe(
      seuls.reduce((n, q) => n + q.color, 0),
    );
  });

  test('un panier d’un seul volume ne fait économiser rien', () => {
    const d = quoteForVolumeIds(['pc-t']);
    for (const format of ['pdf', 'papier-nb', 'papier-couleur'] as ManuelFormat[]) {
      expect(savingForFormat(d, format).tnd).toBe(0);
      expect(savingForFormat(d, format).pct).toBe(0);
    }
  });
});

describe('sélection et formats', () => {
  test('un identifiant inconnu est refusé plutôt qu’ignoré en silence', () => {
    expect(() => quoteForVolumeIds(['pc-t', 'neant-x'])).toThrow(/neant-x/);
  });

  test('un même volume compté deux fois ne l’est qu’une', () => {
    expect(quoteForVolumeIds(['pc-t', 'pc-t'])).toEqual(quoteForVolumeIds(['pc-t']));
  });

  test('le total dépend du format choisi', () => {
    const d = quote([675], BAREME);
    const attendu: Record<ManuelFormat, number> = {
      pdf: 108,
      'papier-nb': 197,
      'papier-couleur': 305,
    };
    for (const [format, montant] of Object.entries(attendu)) {
      expect(totalForFormat(d, format as ManuelFormat)).toBe(montant);
    }
  });
});
