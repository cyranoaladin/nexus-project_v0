import { getSkillGraph } from '@/lib/aria/curriculum/skill-graph';

describe('ARIA Skill Graph Adapter', () => {
  it('charge le graphe compilé pour Maths Première avec IDs préfixés', () => {
    const graph = getSkillGraph('eds-maths-premiere');
    expect(graph).not.toBeNull();
    expect(graph?.courseKey).toBe('eds-maths-premiere');
    expect(graph?.domains.length).toBeGreaterThan(0);
    expect(graph?.totalCompetencies).toBeGreaterThan(10);

    const firstDomain = graph?.domains[0];
    expect(firstDomain?.id).toMatch(/^eds-maths-premiere:/);

    const firstCompetency = firstDomain?.competencies[0];
    expect(firstCompetency?.id).toMatch(/^eds-maths-premiere:/);
    expect(firstCompetency?.label.length).toBeGreaterThan(0);
  });

  it('charge le graphe compilé pour NSI Terminale', () => {
    const graph = getSkillGraph('eds-nsi-terminale');
    expect(graph).not.toBeNull();
    expect(graph?.courseKey).toBe('eds-nsi-terminale');
    expect(graph?.domains.length).toBeGreaterThan(0);
  });

  it('charge le graphe compilé pour les matières technologiques STMG', () => {
    const sgnGraph = getSkillGraph('stmg-sgn-premiere');
    expect(sgnGraph).not.toBeNull();
    expect(sgnGraph?.courseKey).toBe('stmg-sgn-premiere');

    const mgtGraph = getSkillGraph('stmg-management-premiere');
    expect(mgtGraph).not.toBeNull();

    const droitGraph = getSkillGraph('stmg-droit-eco-premiere');
    expect(droitGraph).not.toBeNull();
  });

  it('retourne null pour un cours sans graphe de compétences', () => {
    expect(getSkillGraph('cours-inconnu')).toBeNull();
  });
});
