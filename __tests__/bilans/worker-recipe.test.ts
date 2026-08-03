import { readFileSync } from 'node:fs';

import {
  generateWorkerRecipeEvidence,
  WORKER_RECIPE_PATH,
} from '@/scripts/bilans/generate-worker-recipe-evidence';

describe('A104 raw-answer worker recipe', () => {
  it('traverse le scoring et le rendu de façon déterministe sans réseau', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    let first;
    let second;
    try {
      first = generateWorkerRecipeEvidence();
      second = generateWorkerRecipeEvidence();
    } finally {
      fetchSpy.mockRestore();
    }

    expect(first.json).toBe(second.json);
    expect(first.json).toBe(readFileSync(WORKER_RECIPE_PATH, 'utf8'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(first.artifact.pipeline).toEqual([
      'rawAnswers', 'computeFacts', 'computeDomainScores', 'buildFactSheet', 'buildDeterministicReports',
    ]);
    expect(new Set(first.artifact.facts.items.map(({ profile }) => profile))).toEqual(new Set([
      'MAITRISE',
      'MAITRISE_FRAGILE',
      'ERREUR_CONFIANTE',
      'LACUNE_CONSCIENTE',
      'NON_TRAITE',
    ]));
    expect(first.artifact.factSheet.coverage).toBeLessThan(100);
    expect(first.artifact.factSheet.flags).toContain('PASSATION_PARTIELLE');
    expect(first.artifact.factSheet.domains).toHaveLength(9);
    expect(Object.keys(first.artifact.reports).sort()).toEqual(['ELEVE', 'NEXUS', 'PARENTS']);
  });
});
