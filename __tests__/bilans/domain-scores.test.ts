import { computeDomainScores } from '@/lib/bilans/facts/domain-scores';

const item = (
  itemId: string,
  nodeCpsId: string,
  weight: 1 | 2 | 3,
  rawSuccess: number,
) => ({ itemId, nodeCpsId, weight, rawSuccess });

describe('computeDomainScores', () => {
  it('pondere la reussite par la difficulte des items', () => {
    expect(computeDomainScores(
      ['analyse'],
      { 'analyse.derivation': 'analyse' },
      [
        item('q1', 'analyse.derivation', 1, 1),
        item('q2', 'analyse.derivation', 3, 0),
      ],
    )).toEqual([{ domain: 'analyse', score: 25 }]);
  });

  it('conserve la reussite partielle dans le score de domaine', () => {
    expect(computeDomainScores(
      ['probabilites'],
      { 'probabilites.conditionnelles': 'probabilites' },
      [
        item('q1', 'probabilites.conditionnelles', 2, 0.5),
        item('q2', 'probabilites.conditionnelles', 2, 1),
      ],
    )).toEqual([{ domain: 'probabilites', score: 75 }]);
  });

  it('retourne zero pour un domaine du pack sans item', () => {
    expect(computeDomainScores(
      ['analyse', 'geometrie'],
      { 'analyse.derivation': 'analyse' },
      [item('q1', 'analyse.derivation', 1, 1)],
    )).toEqual([
      { domain: 'analyse', score: 100 },
      { domain: 'geometrie', score: 0 },
    ]);
  });

  it('echoue si le noeud CPS d un item n est rattache a aucun domaine', () => {
    expect(() => computeDomainScores(
      ['analyse'],
      {},
      [item('q1', 'analyse.derivation', 1, 1)],
    )).toThrow('Fact item q1 node analyse.derivation is not bound to a pack domain');
  });
});
