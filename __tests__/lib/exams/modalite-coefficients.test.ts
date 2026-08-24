import { requireExamPolicy } from '@/lib/exams/catalog';
import { isAVerifier } from '@/lib/exams/a-verifier';

describe('T-modalite — coefficients par modalité A/B (tronc commun ponctuel)', () => {
  const policy = requireExamPolicy(2027);
  const byId = new Map(policy.epreuves.map((e) => [e.id, e]));

  test('enseignement scientifique: modalité A = 6 (cycle terminal), modalité B = 3+3 (confirmé par note de service)', () => {
    const ep = byId.get('enseignement-scientifique');
    expect(ep?.coefficientParModalite?.A).toBe(6);
    expect(ep?.coefficientParModalite?.B).toEqual({ premiere: 3, terminale: 3 });
  });

  test('HG, LVA, LVB, EMC restent explicitement À_VERIFIER pour la modalité B — jamais une valeur devinée', () => {
    for (const id of ['histoire-geographie', 'lva', 'lvb', 'emc']) {
      const ep = byId.get(id);
      expect(isAVerifier(ep?.coefficientParModalite?.B)).toBe(true);
      expect(typeof ep?.coefficientParModalite?.A).toBe('number');
    }
  });

  test('EPS reste hors modalité A/B — épreuve ponctuelle terminale unique (arrêté du 21 décembre 2011)', () => {
    const ep = byId.get('eps');
    expect(ep?.coefficientParModalite).toBeUndefined();
  });
});
