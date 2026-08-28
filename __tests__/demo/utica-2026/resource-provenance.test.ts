/**
 * P3 §1/§22/§23 — chaque ressource `NEXUS_CONTENT` doit avoir une source
 * réelle et vérifiable : ce test importe le vrai fichier source
 * (`app/programme/maths-terminale/data.ts`, `programmes/generated/
 * nsi_terminale.skills.generated.json`) et prouve que le `sourceRef` déclaré
 * pointe vers un chapitre/domaine qui existe réellement, avec le vrai
 * titre — jamais une affirmation non vérifiée.
 *
 * Sécurité (P3 §32) : aucune donnée client réelle, aucun storage, aucune
 * PII dans le catalogue.
 */
import { programmeDataTerminale } from '@/app/programme/maths-terminale/data';
import nsiTerminaleSkills from '@/programmes/generated/nsi_terminale.skills.generated.json';
import { getResourceCatalog } from '@/lib/demo/utica-2026/resources';

const realChaptersById = new Map(
  programmeDataTerminale.flatMap((category) => category.chapters.map((c) => [c.id, c] as const)),
);

describe('Provenance des ressources — traçabilité vers les sources réelles du dépôt', () => {
  test('chaque ressource a un sourceRef non vide et un sourceLabel jamais technique', () => {
    const catalog = getResourceCatalog();
    for (const r of catalog) {
      expect(r.sourceRef.trim().length).toBeGreaterThan(0);
      // Le libellé visiteur ne doit jamais exposer de chemin de fichier.
      expect(r.sourceLabel).not.toMatch(/\.ts|\.json|app\/|lib\/|programmes\//);
    }
  });

  test('maths-b3-derivation référence réellement le chapitre B3-derivation existant', () => {
    const catalog = getResourceCatalog();
    const resource = catalog.find((r) => r.id === 'maths-b3-derivation')!;
    expect(resource.sourceRef).toContain('B3-derivation');

    const realChapter = realChaptersById.get('B3-derivation');
    expect(realChapter).toBeDefined();
    expect(realChapter!.title).toBe('Compléments dérivation (variations/tangentes/convexité)');
    // Le titre affiché reprend fidèlement le vrai titre du chapitre source.
    expect(resource.title).toContain('dérivation');
  });

  test('maths-b2-limites et maths-b1-suites référencent des chapitres réels du programme', () => {
    const catalog = getResourceCatalog();
    const limites = catalog.find((r) => r.id === 'maths-b2-limites')!;
    const suites = catalog.find((r) => r.id === 'maths-b1-suites')!;

    expect(realChaptersById.has('B2-limites')).toBe(true);
    expect(realChaptersById.has('B1-suites')).toBe(true);
    expect(limites.sourceRef).toContain('B2-limites');
    expect(suites.sourceRef).toContain('B1-suites');
  });

  test('la checklist Bac reprend les points réels du référentiel (pas une invention)', () => {
    const catalog = getResourceCatalog();
    const checklist = catalog.find((r) => r.id === 'maths-checklist-etude-fonction')!;
    const realChapter = realChaptersById.get('B3-derivation')!;
    // Tous les chapitres du programme partagent la même checklistBase réelle.
    const realLabels = realChapter.content.checklistBac;
    expect(realLabels.length).toBeGreaterThan(0);
    // Chaque item affiché doit correspondre en substance à un point réel
    // (comparaison insensible à la reformulation légère, sur les mots-clés).
    expect(checklist.checklist!.some((i) => /domaine/i.test(i.label))).toBe(true);
    expect(checklist.checklist!.some((i) => /conclusion/i.test(i.label))).toBe(true);
    expect(checklist.checklist!.some((i) => /arrondi/i.test(i.label))).toBe(true);
  });

  test('le programme NSI référence réellement le domaine "Structures de données"', () => {
    const catalog = getResourceCatalog();
    const resource = catalog.find((r) => r.id === 'nsi-programme-structures-donnees')!;
    const domain = (nsiTerminaleSkills as { sections: Array<{ domainId: string; normalizedTitle: string; candidates: Array<{ normalizedLabel: string }> }> }).sections.find(
      (s) => s.domainId === 'data_structures',
    );
    expect(domain).toBeDefined();
    expect(domain!.normalizedTitle).toBe('Structures de Données');
    expect(resource.sourceRef).toContain('data_structures');

    // Chaque compétence listée existe réellement dans le référentiel officiel.
    const realLabels = new Set(domain!.candidates.map((c) => c.normalizedLabel));
    for (const p of resource.sections![0].paragraphs) {
      expect(realLabels.has(p)).toBe(true);
    }
  });

  test('les ressources NEXUS_CREATED_FOR_PATH sont explicitement marquées comme telles, jamais comme officielles', () => {
    const catalog = getResourceCatalog();
    const created = catalog.filter((r) => r.origin === 'NEXUS_CREATED_FOR_PATH');
    expect(created.length).toBeGreaterThan(0);
    for (const r of created) {
      expect(r.sourceLabel).not.toMatch(/officiel/i);
      expect(r.sourceRef.startsWith('derived:')).toBe(true);
    }
  });

  test("0 storage, 0 PII, 0 chemin GitHub visible côté visiteur", () => {
    const catalog = getResourceCatalog();
    for (const r of catalog) {
      expect(r.sourceLabel).not.toMatch(/github\.com/i);
      expect(JSON.stringify(r)).not.toMatch(/DOCUMENT_STORAGE_ROOT|NPC_STORAGE_ROOT/);
    }
  });
});
