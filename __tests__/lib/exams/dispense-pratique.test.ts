import { requireExamPolicy, hasPracticalPartDispensation } from '@/lib/exams/catalog';
import { requireResolved } from '@/lib/exams/a-verifier';

describe('T-dispense — partie pratique des spécialités NSI/PC/SI/SVT', () => {
  const policy = requireExamPolicy(2027);
  const rules = requireResolved(policy.candidatIndividuelRules, 'session 2027 candidatIndividuelRules');

  test('NSI, physique-chimie, sciences de l\'ingénieur et SVT sont dispensées de partie pratique pour un candidat individuel', () => {
    for (const code of ['NSI', 'PHYSIQUE_CHIMIE', 'SCIENCES_INGENIEUR', 'SVT']) {
      expect(hasPracticalPartDispensation(policy, code)).toBe(true);
    }
  });

  test('une spécialité sans partie pratique (ex. HGGSP) n\'est pas concernée — retourne false, pas une exception', () => {
    expect(hasPracticalPartDispensation(policy, 'HGGSP')).toBe(false);
  });

  test('le policy expose la liste sourcée des spécialités concernées', () => {
    expect(rules.dispensePartiePratique.specialitesConcernees).toEqual(
      expect.arrayContaining(['NSI', 'PHYSIQUE_CHIMIE', 'SCIENCES_INGENIEUR', 'SVT']),
    );
    expect(rules.dispensePartiePratique.sourceArticle).toMatch(/22 juillet 2019/);
  });
});
