import { canEmitAutomatically } from '@/lib/exams/emission-gate';
import { requireExamPolicy } from '@/lib/exams/catalog';
import { validateProfilCandidat } from '@/lib/exams/profile-validation';
import { genererCarteExamen } from '@/lib/exams/carte';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';

const policy2027 = requireExamPolicy(2027);

function baseProfil(overrides: Partial<ProfilCandidatInput> = {}): ProfilCandidatInput {
  return {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
    specialiteAbandonnee: null,
    langueA: null,
    langueB: null,
    estRedoublant: false,
    estTitulaireBacDejaObtenu: false,
    changementSpecialite: false,
    intentionAmelioration: false,
    intentionCycleComplet: true,
    brancheBascule: null,
    epreuvesDispenseesDeclarees: [],
    dispensesDeclarees: [],
    etalementPlurisessionsDeclare: false,
    moyenneRattrapage: null,
    optionsTerminale: [],
    notesConservees: [],
    ...overrides,
  };
}

describe('canEmitAutomatically — AND, jamais OR', () => {
  test.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ])('validation=%s, carte=%s => %s', (v, c, expected) => {
    expect(
      canEmitAutomatically({ emissionAutomatiqueAutorisee: v }, { emissionAutomatiqueAutorisee: c }),
    ).toBe(expected);
  });
});

describe('canEmitAutomatically — intégration réelle validateProfilCandidat + genererCarteExamen', () => {
  test('profil nominal : les deux gates sont vraies, la composition autorise l\'émission', () => {
    const profil = baseProfil();
    const validation = validateProfilCandidat(policy2027, { profil });
    const carte = genererCarteExamen({ profil, policy: policy2027 });
    expect(canEmitAutomatically(validation, carte)).toBe(true);
  });

  test('mécanisme indéterminé : les deux gates bloquent, la composition reste fausse', () => {
    const profil = baseProfil({
      estRedoublant: true,
      notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'INDETERMINE' }],
    });
    const validation = validateProfilCandidat(policy2027, { profil });
    const carte = genererCarteExamen({ profil, policy: policy2027 });
    expect(validation.emissionAutomatiqueAutorisee).toBe(false);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
    expect(canEmitAutomatically(validation, carte)).toBe(false);
  });

  test('la composition ne peut jamais être vraie si un seul des deux gates est faux (preuve sur tout le jeu de scénarios de la matrice P1-P12)', () => {
    const scenarios: Array<Partial<ProfilCandidatInput>> = [
      { modalite: 'A' },
      { modalite: 'B' },
      { estRedoublant: true },
      { estTitulaireBacDejaObtenu: true },
      { etalementPlurisessionsDeclare: true },
      { optionsTerminale: ['DGEMC'] },
    ];
    for (const overrides of scenarios) {
      const profil = baseProfil(overrides);
      const validation = validateProfilCandidat(policy2027, { profil });
      const carte = genererCarteExamen({ profil, policy: policy2027 });
      const composed = canEmitAutomatically(validation, carte);
      if (composed) {
        expect(validation.emissionAutomatiqueAutorisee).toBe(true);
        expect(carte.emissionAutomatiqueAutorisee).toBe(true);
      } else {
        expect(validation.emissionAutomatiqueAutorisee === false || carte.emissionAutomatiqueAutorisee === false).toBe(true);
      }
    }
  });
});
