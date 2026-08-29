/**
 * Adaptateur de graphes de compétences.
 *
 * Point critique vérifié ici : les `skillId` sont stables mais NON uniques
 * entre programmes (`PY_FUNC`, `ANA_EXP` existent en Première ET en Terminale).
 * Les identifiants exposés doivent donc être préfixés par la clé de cours.
 */

import {
  getCourseCompetencies,
  getCourseDomains,
  getSkillGraph,
  getSkillGraphSummary,
  listCompiledDefinitionKeys,
} from '@/lib/aria/curriculum/skill-graph';
import { getAriaCourse, listAriaCourses } from '@/lib/aria/curriculum/catalog';

describe('adaptateur skill graph', () => {
  it('embarque les 8 définitions compilées', () => {
    expect(listCompiledDefinitionKeys()).toHaveLength(8);
  });

  it('retourne un graphe pour chaque cours qui en déclare un', () => {
    for (const course of listAriaCourses()) {
      const graph = getSkillGraph(course.key);
      if (course.definitionKey) {
        expect(graph).not.toBeNull();
        expect(graph?.definitionKey).toBe(course.definitionKey);
        expect(graph?.domains.length).toBeGreaterThan(0);
        expect(graph?.competencies.length).toBeGreaterThan(0);
      } else {
        expect(graph).toBeNull();
      }
    }
  });

  it('préfixe tous les identifiants par la clé de cours', () => {
    const graph = getSkillGraph('maths-terminale-eds');
    expect(graph).not.toBeNull();
    for (const domain of graph!.domains) {
      expect(domain.id).toBe(`maths-terminale-eds:${domain.domainId}`);
    }
    for (const competency of graph!.competencies) {
      expect(competency.id).toBe(`maths-terminale-eds:${competency.skillId}`);
    }
  });

  it('désambiguïse les skillId partagés entre Première et Terminale', () => {
    const premiere = getSkillGraph('maths-premiere-eds');
    const terminale = getSkillGraph('maths-terminale-eds');
    expect(premiere).not.toBeNull();
    expect(terminale).not.toBeNull();

    const premiereRawIds = new Set(premiere!.competencies.map((c) => c.skillId));
    const shared = terminale!.competencies.filter((c) => premiereRawIds.has(c.skillId));
    // Le dépôt contient réellement des skillId partagés entre les deux programmes.
    expect(shared.length).toBeGreaterThan(0);

    // Malgré le partage des skillId bruts, aucun identifiant exposé ne collisionne.
    const allIds = [
      ...premiere!.competencies.map((c) => c.id),
      ...terminale!.competencies.map((c) => c.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('produit des identifiants déterministes entre deux appels', () => {
    const first = getSkillGraph('nsi-premiere-eds');
    const second = getSkillGraph('nsi-premiere-eds');
    expect(first?.competencies.map((c) => c.id)).toEqual(second?.competencies.map((c) => c.id));
  });

  it('rattache chaque compétence à un domaine déclaré', () => {
    for (const course of listAriaCourses()) {
      const graph = getSkillGraph(course.key);
      if (!graph) continue;
      const domainIds = new Set(graph.domains.map((domain) => domain.domainId));
      for (const competency of graph.competencies) {
        expect(domainIds.has(competency.domainId)).toBe(true);
      }
      const declared = graph.domains.reduce((sum, domain) => sum + domain.competencyCount, 0);
      expect(declared).toBe(graph.competencies.length);
    }
  });

  it('retourne null / tableaux vides pour un cours sans graphe', () => {
    expect(getAriaCourse('philosophie-terminale')?.definitionKey).toBeNull();
    expect(getSkillGraph('philosophie-terminale')).toBeNull();
    expect(getCourseDomains('philosophie-terminale')).toEqual([]);
    expect(getCourseCompetencies('philosophie-terminale')).toEqual([]);
  });

  it('ne lève jamais sur une clé inconnue ou malformée', () => {
    for (const key of ['inconnu', '../../etc/passwd', '', 'maths-terminale-eds/../x']) {
      expect(() => getSkillGraph(key)).not.toThrow();
      expect(getSkillGraph(key)).toBeNull();
    }
  });

  it('produit un résumé honnête, sans chemin fichier', () => {
    const present = getSkillGraphSummary('maths-terminale-eds');
    expect(present.available).toBe(true);
    expect(present.domainCount).toBeGreaterThan(0);
    expect(JSON.stringify(present)).not.toMatch(/\.json|programmes\/|lib\//);

    const absent = getSkillGraphSummary('philosophie-terminale');
    expect(absent).toEqual({
      courseKey: 'philosophie-terminale',
      available: false,
      domainCount: 0,
      competencyCount: 0,
      version: null,
    });
  });

  it('expose les 4 graphes STMG de Première', () => {
    for (const key of [
      'maths-premiere-stmg',
      'sgn-premiere-stmg',
      'management-premiere-stmg',
      'droit-eco-premiere-stmg',
    ]) {
      const graph = getSkillGraph(key);
      expect(graph).not.toBeNull();
      expect(graph!.competencies.length).toBeGreaterThan(0);
    }
  });
});
