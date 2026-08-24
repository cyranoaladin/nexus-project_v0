import { requireExamPolicy } from '@/lib/exams/catalog';
import { requireResolved } from '@/lib/exams/a-verifier';

describe('T-parcours — structures déclaratives pour P7/P8/P11 (Lot 3 les consommera)', () => {
  const policy = requireExamPolicy(2027);
  const rules = requireResolved(policy.candidatIndividuelRules, 'session 2027 candidatIndividuelRules');

  test('bascule scolaire vers individuel expose ses deux branches (§2.9)', () => {
    const b = rules.basculeScolaireVersIndividuel;
    expect(b.branches.map((x) => x.id)).toEqual(
      expect.arrayContaining(['conservation_moyennes_premiere', 'renonciation_moyennes_premiere']),
    );
    for (const branche of b.branches) {
      expect(branche.consequence.length).toBeGreaterThan(0);
    }
  });

  test('dispenses pour titulaire du bac référencent l\'arrêté du 14 mai 2020', () => {
    const d = rules.dispensesTitulaireBac;
    expect(d.sourceArticle).toMatch(/14 mai 2020/);
    expect(d.perimetre).toBe('declaratif');
  });

  test('second groupe (rattrapage) expose la fenêtre et le nombre de disciplines', () => {
    const g = rules.secondGroupe;
    expect(g.moyenneMin).toBe(8);
    expect(g.moyenneMax).toBe(10);
    expect(g.nombreDisciplines).toBe(2);
  });
});
