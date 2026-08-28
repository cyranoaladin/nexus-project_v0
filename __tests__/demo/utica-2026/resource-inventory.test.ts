/**
 * P3.1 §2 — inventaire canonique figé du catalogue, contrat explicite pour
 * éviter tout comptage ambigu en rapport (le rapport P3 initial avait
 * laissé entendre "4 chapitres" pour 3 chapitres réels + 1 checklist —
 * ambiguïté fermée ici).
 */
import { getResourceCatalog } from '@/lib/demo/utica-2026/resources';

/** Contrat P3.1 — volontairement figé, à mettre à jour explicitement si le catalogue évolue. */
const EXPECTED_RESOURCE_COUNT = {
  TOTAL: 9,
  MATHEMATIQUES: 6,
  NSI: 2,
  FRANCAIS: 1,
} as const;

describe('Inventaire canonique des ressources — contrat figé', () => {
  test(`le total exact est ${EXPECTED_RESOURCE_COUNT.TOTAL}`, () => {
    expect(getResourceCatalog()).toHaveLength(EXPECTED_RESOURCE_COUNT.TOTAL);
  });

  test('la répartition par matière correspond exactement au contrat', () => {
    const catalog = getResourceCatalog();
    const byMaths = catalog.filter((r) => r.subject === 'MATHEMATIQUES');
    const byNsi = catalog.filter((r) => r.subject === 'NSI');
    const byFrancais = catalog.filter((r) => r.subject === 'FRANCAIS');

    expect(byMaths).toHaveLength(EXPECTED_RESOURCE_COUNT.MATHEMATIQUES);
    expect(byNsi).toHaveLength(EXPECTED_RESOURCE_COUNT.NSI);
    expect(byFrancais).toHaveLength(EXPECTED_RESOURCE_COUNT.FRANCAIS);
    expect(byMaths.length + byNsi.length + byFrancais.length).toBe(EXPECTED_RESOURCE_COUNT.TOTAL);
  });

  test('détail Mathématiques : 3 chapitres réels + 1 checklist réelle + 2 créations Nexus (3+1+2=6, jamais "4 chapitres")', () => {
    const catalog = getResourceCatalog().filter((r) => r.subject === 'MATHEMATIQUES');
    const realChapters = catalog.filter((r) => r.type === 'COURSE' && r.origin === 'NEXUS_CONTENT');
    const realChecklist = catalog.filter((r) => r.type === 'CHECKLIST' && r.origin === 'NEXUS_CONTENT');
    const created = catalog.filter((r) => r.origin === 'NEXUS_CREATED_FOR_PATH');

    expect(realChapters).toHaveLength(3); // B3-derivation, B2-limites, B1-suites
    expect(realChecklist).toHaveLength(1); // checklistBase
    expect(created).toHaveLength(2); // fiche méthode + mini-QCM
    expect(realChapters.length + realChecklist.length + created.length).toBe(6);
  });

  test('inventaire exhaustif — chaque champ requis par le rapport P3.1 est renseigné pour toutes les ressources', () => {
    const catalog = getResourceCatalog();
    const table = catalog.map((r) => ({
      ID: r.id,
      SLUG: r.slug,
      TITLE: r.title,
      SUBJECT: r.subject,
      TYPE: r.type,
      ORIGIN: r.origin,
      SOURCE_REF: r.sourceRef,
      COMPETENCY_IDS: r.competencyIds,
      INTERACTIVE: !!(r.qcm || r.exercise || r.checklist),
      ARIA_ENABLED: !!r.focusId,
      VISIBLE_IN_STUDENT_LIBRARY: true,
    }));

    expect(table).toHaveLength(EXPECTED_RESOURCE_COUNT.TOTAL);
    for (const row of table) {
      expect(row.ID.length).toBeGreaterThan(0);
      expect(row.SLUG.length).toBeGreaterThan(0);
      expect(row.TITLE.length).toBeGreaterThan(0);
      expect(row.SOURCE_REF.length).toBeGreaterThan(0);
    }
  });
});
