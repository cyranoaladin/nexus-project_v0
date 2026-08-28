/**
 * P3 §23/§33 — cohérence structurelle du catalogue de ressources.
 */
import { demoScenario } from '@/lib/demo/utica-2026/scenario';
import { getResourceCatalog, getResourceById, getResourceBySlug, getRecommendedCatalogResource } from '@/lib/demo/utica-2026/resources';

describe('Catalogue de ressources — cohérence structurelle', () => {
  test('tous les slugs sont uniques', () => {
    const catalog = getResourceCatalog();
    const slugs = catalog.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('tous les id sont uniques', () => {
    const catalog = getResourceCatalog();
    const ids = catalog.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('chaque ressource pédagogique (hors plateforme externe) a au moins une competencyId non vide', () => {
    const catalog = getResourceCatalog();
    for (const r of catalog) {
      if (r.origin === 'EAF_PLATFORM') continue;
      expect(r.competencyIds.length).toBeGreaterThan(0);
      for (const id of r.competencyIds) {
        expect(id.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('aucune ressource orpheline : chaque competencyId référencé existe réellement dans le scénario', () => {
    const catalog = getResourceCatalog();
    const knownCompetencyIds = new Set(
      demoScenario.subjectTracks.flatMap((t) => t.competencies.map((c) => c.id)),
    );
    for (const r of catalog) {
      for (const id of r.competencyIds) {
        expect(knownCompetencyIds.has(id)).toBe(true);
      }
    }
  });

  test('getResourceBySlug retrouve chaque ressource par son propre slug', () => {
    const catalog = getResourceCatalog();
    for (const r of catalog) {
      expect(getResourceBySlug(r.slug)?.id).toBe(r.id);
    }
  });

  test('getResourceById retrouve chaque ressource par son propre id', () => {
    const catalog = getResourceCatalog();
    for (const r of catalog) {
      expect(getResourceById(r.id)?.slug).toBe(r.slug);
    }
  });

  test('la ressource principale (recommandée) cible bien le focus pédagogique central', () => {
    const recommended = getRecommendedCatalogResource();
    expect(recommended.focusId).toBe('focus-maths-signe-derivee');
    expect(recommended.competencyIds).toContain(demoScenario.subjectTracks[0].competencies.find((c) => c.label === 'Signe de la dérivée')?.id);
  });

  test('au moins 4 ressources Mathématiques et 2 ressources NSI réelles (P3 §4/§5)', () => {
    const catalog = getResourceCatalog();
    const maths = catalog.filter((r) => r.subject === 'MATHEMATIQUES');
    const nsi = catalog.filter((r) => r.subject === 'NSI');
    expect(maths.length).toBeGreaterThanOrEqual(4);
    expect(nsi.length).toBeGreaterThanOrEqual(2);
  });

  test('au moins 2 interactions locales réelles (qcm, exercice guidé, ou checklist)', () => {
    const catalog = getResourceCatalog();
    const interactive = catalog.filter((r) => r.qcm || r.exercise || r.checklist);
    expect(interactive.length).toBeGreaterThanOrEqual(2);
  });

  test("chaque question de QCM a un index de bonne réponse valide et une explication non vide", () => {
    const catalog = getResourceCatalog();
    for (const r of catalog) {
      for (const q of r.qcm ?? []) {
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
        expect(q.explanation.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
