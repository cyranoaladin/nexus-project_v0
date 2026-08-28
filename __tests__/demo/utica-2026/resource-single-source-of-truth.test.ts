/**
 * P3.1 §3 — une seule source de vérité pour les ressources. Avant ce
 * correctif, `demoScenario.resources` (P1B, liste simple) et
 * `resourceCatalog` (P3, catalogue riche) contenaient deux titres
 * indépendants et divergents pour le même contenu réel (ex. "Fiche — signe
 * de la dérivée..." vs "Compléments dérivation — variations..."). Ce test
 * verrouille la non-divergence désormais garantie par
 * `catalogResourceToStudentSummary()`.
 */
import { demoScenario } from '@/lib/demo/utica-2026/scenario';
import { getPedagogicalFocus, getStudentResources, getWeeklySnapshot } from '@/lib/demo/utica-2026/selectors';
import { getRecommendedCatalogResource, getResourceById } from '@/lib/demo/utica-2026/resources';

describe('Source unique de vérité des ressources — non-divergence', () => {
  test('RESOURCE_SINGLE_SOURCE_OF_TRUTH=PASS — les entrées de demoScenario.resources ayant un équivalent catalogue reprennent son titre exact', () => {
    const b3 = getResourceById('maths-b3-derivation')!;
    const nsiFiche = getResourceById('nsi-fiche-piles-files')!;

    const legacyMaths = demoScenario.resources.find((r) => r.id === 'maths-b3-derivation');
    const legacyNsi = demoScenario.resources.find((r) => r.id === 'nsi-fiche-piles-files');

    expect(legacyMaths).toBeDefined();
    expect(legacyNsi).toBeDefined();
    expect(legacyMaths!.title).toBe(b3.title);
    expect(legacyNsi!.title).toBe(nsiFiche.title);
    expect(legacyMaths!.competencyIds).toEqual(b3.competencyIds);
    expect(legacyNsi!.competencyIds).toEqual(nsiFiche.competencyIds);
  });

  test('la ressource recommandée affichée sur Élève = la ressource ouverte = la ressource transmise à ARIA', () => {
    const focus = getPedagogicalFocus();
    const studentRecommended = getStudentResources().recommended;
    const catalogRecommended = getRecommendedCatalogResource();
    const weeklySnapshotRecommended = getWeeklySnapshot().recommendedResource;

    // 1) La ressource "recommandée" du fold Élève (ancienne liste, projetée)
    //    partage exactement le titre du catalogue riche.
    expect(studentRecommended?.title).toBe(catalogRecommended.title);
    expect(weeklySnapshotRecommended?.title).toBe(catalogRecommended.title);

    // 2) La ressource "ouverte" par le visiteur (catalogue riche) cible bien
    //    le focus pédagogique central — même compétence que ce qui est
    //    affiché ailleurs.
    expect(catalogRecommended.competencyIds).toContain(focus.fragileCompetencyId);

    // 3) La ressource transmise à ARIA via ?resource=<id> est la MÊME
    //    entrée catalogue (même id), jamais une resynthèse indépendante.
    expect(catalogRecommended.id).toBe('maths-b3-derivation');
    expect(getResourceById(catalogRecommended.id)?.id).toBe(catalogRecommended.id);
  });

  test("aucun titre de ressource n'est dupliqué avec une formulation différente entre demoScenario.resources et le catalogue", () => {
    const catalogTitlesById = new Map(
      require('@/lib/demo/utica-2026/resources')
        .getResourceCatalog()
        .map((r: { id: string; title: string }) => [r.id, r.title]),
    );
    for (const legacy of demoScenario.resources) {
      if (catalogTitlesById.has(legacy.id)) {
        expect(legacy.title).toBe(catalogTitlesById.get(legacy.id));
      }
    }
  });
});
