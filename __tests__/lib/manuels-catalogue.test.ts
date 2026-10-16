/**
 * Catalogue des manuels pour candidats individuels — garde-fous de la source canonique.
 *
 * Le bloc `manuels` de data/pricing.canonical.json est ENGENDRÉ par
 * work/offre/exporter_manuels.py (Maison édition Nexus Réussite) à partir des
 * MANIFEST.json de la zone de publication. Ces tests figent ce que le reste de
 * l'application est en droit d'attendre : ils échouent si une régénération
 * change le barème, la pagination ou le périmètre du catalogue sans décision.
 */
import {
  getManuels,
  getManuelsBareme,
  getManuelVolume,
  type ManuelVolume,
} from '@/lib/pricing';

describe('catalogue des manuels — périmètre', () => {
  test('41 volumes, 7 118 pages, mesurés le 2026-10-15', () => {
    const { volumes } = getManuels();
    expect(volumes).toHaveLength(41);
    expect(volumes.reduce((n, v) => n + v.pages, 0)).toBe(7118);
  });

  test('chaque volume porte un identifiant unique, un titre, une discipline et un niveau', () => {
    const { volumes } = getManuels();
    const ids = new Set(volumes.map((v) => v.id));
    expect(ids.size).toBe(volumes.length);
    for (const v of volumes) {
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.disciplineLabel.length).toBeGreaterThan(0);
      expect(v.pages).toBeGreaterThan(0);
      expect(['Première', 'Terminale', 'cycle terminal']).toContain(v.level);
      expect(['tronc-commun', 'specialite', 'epreuve-anticipee-maths']).toContain(v.family);
    }
  });

  test('paginations de référence', () => {
    expect(getManuelVolume('pc-t')?.pages).toBe(675);
    expect(getManuelVolume('es-p')?.pages).toBe(643);
    expect(getManuelVolume('philosophie-t')?.pages).toBe(200);
    expect(getManuelVolume('maths-spec-eleve')?.pages).toBe(131);
    expect(getManuelVolume('emc-p')?.pages).toBe(71);
  });

  test('les quatre volumes de mathématiques en spécialité sont marqués sans paquet de publication', () => {
    const sansPaquet = getManuels().volumes.filter((v: ManuelVolume) => !v.packaged);
    expect(sansPaquet.map((v) => v.volumeId).sort()).toEqual([
      'MATHS_EDS/1RE_CORRIGES',
      'MATHS_EDS/1RE_ELEVE',
      'MATHS_EDS/TSPE_T1',
      'MATHS_EDS/TSPE_T2',
    ]);
  });

  test('sept volumes seulement portent une source d’impression déclarée', () => {
    const imprimables = getManuels().volumes.filter((v) => v.printDeclared);
    expect(imprimables).toHaveLength(7);
  });

  test('tout identifiant public est une limace URL-sûre, et l’identifiant de manifeste est conservé', () => {
    for (const v of getManuels().volumes) {
      expect(v.id).toMatch(/^[a-z0-9-]+$/);
      expect(v.volumeId.length).toBeGreaterThan(0);
    }
  });

  test('un identifiant inconnu ne renvoie rien', () => {
    expect(getManuelVolume('neant-x')).toBeUndefined();
  });
});

describe('barème v2 — adopté le 2026-10-15', () => {
  test('tranches cumulatives en centimes entiers', () => {
    expect(getManuelsBareme().tiers).toEqual([
      { upToPage: 150, centimesPerPage: 34 },
      { upToPage: 400, centimesPerPage: 13 },
      { upToPage: 1200, centimesPerPage: 9 },
      { upToPage: 3000, centimesPerPage: 8 },
      { upToPage: null, centimesPerPage: 7 },
    ]);
  });

  test('plancher 15 DT, annexes de 12 pages ou moins offertes', () => {
    const b = getManuelsBareme();
    expect(b.floorTnd).toBe(15);
    expect(b.freeUpToPages).toBe(12);
  });

  test('les deux lignes papier et le groupage', () => {
    const { paper } = getManuelsBareme();
    expect(paper.bwCentimesPerPage).toBe(12);
    expect(paper.colorCentimesPerPage).toBe(28);
    expect(paper.perVolumeCentimes).toBe(800);
    expect(paper.groupDiscountCentimes).toBe(100);
    expect(paper.groupDiscountFromVolume).toBe(5);
  });
});
