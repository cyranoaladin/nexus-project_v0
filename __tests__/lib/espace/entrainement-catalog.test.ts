/**
 * Activité « Préparation de l'évaluation NSI » (TAD, POO, récursivité) :
 * cohérence du catalogue, des ressources et de la route.
 */
import { ACTIVITIES, getActivityDef, NSI_ENTRAINEMENT_ACTIVITY_SLUG } from '@/lib/espace/catalog';
import { lessonHref } from '@/lib/espace/lesson-routes';

describe('activité nsi-entrainement-evaluation', () => {
  const def = getActivityDef(NSI_ENTRAINEMENT_ACTIVITY_SLUG);

  it('est déclarée dans le catalogue comme UPLOAD_EXERCISE NSI', () => {
    expect(def).toBeDefined();
    expect(def!.subject).toBe('NSI');
    expect(def!.kind).toBe('UPLOAD_EXERCISE');
    expect(def!.moduleSlug).toBe('entrainement-evaluation');
    expect(def!.stepsTotal).toBe(0);
  });

  it('expose les cinq documents, tous téléchargeables par les élèves', () => {
    expect(def!.resources).toHaveLength(5);
    const keys = def!.resources.map((r) => r.key);
    expect(keys).toEqual(['sujet-1', 'corrige-1', 'sujet-2', 'corrige-2', 'fiche-preparation']);
    for (const r of def!.resources) {
      // Choix pédagogique du 2026-10-09 : corrigés ouverts aux élèves (auto-correction).
      expect(r.audience).toBe('STUDENT');
      expect(r.mimeType).toBe('application/pdf');
      expect(r.file).toBe(`${r.key}.pdf`);
    }
  });

  it('a une route élève dédiée', () => {
    expect(lessonHref(NSI_ENTRAINEMENT_ACTIVITY_SLUG)).toBe('/espace/nsi/entrainement-evaluation');
  });

  it('ne casse pas l’unicité des slugs et des clés de ressources du catalogue', () => {
    const slugs = ACTIVITIES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of ACTIVITIES) {
      const keys = a.resources.map((r) => r.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
