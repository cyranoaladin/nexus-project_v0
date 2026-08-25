import { requireExamPolicy } from '@/lib/exams/catalog';
import { genererCarteExamen } from '@/lib/exams/carte';
import { isAVerifier } from '@/lib/exams/a-verifier';
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
    etalementPlurisessionsDeclare: false,
    moyenneRattrapage: null,
    optionsTerminale: [],
    notesConservees: null,
    ...overrides,
  };
}

describe('genererCarteExamen — P1/P2, cas nominal terminale', () => {
  test('modalité A: toutes les ponctuelles A_PRESENTER, anticipées RECONDUITE, total obligatoire = 100', () => {
    const carte = genererCarteExamen({ profil: baseProfil({ modalite: 'A' }), policy: policy2027 });

    const byCode = new Map(carte.epreuves.map((e) => [e.code, e]));
    expect(byCode.get('eaf-ecrit')?.statut).toBe('RECONDUITE');
    expect(byCode.get('eaf-oral')?.statut).toBe('RECONDUITE');
    expect(byCode.get('eam')?.statut).toBe('RECONDUITE');
    expect(byCode.get('eds1')?.statut).toBe('A_PRESENTER');
    expect(byCode.get('eds2')?.statut).toBe('A_PRESENTER');
    expect(byCode.get('philosophie')?.statut).toBe('A_PRESENTER');
    expect(byCode.get('grand-oral')?.statut).toBe('A_PRESENTER');
    expect(byCode.get('histoire-geographie')?.statut).toBe('A_PRESENTER');
    expect(byCode.get('histoire-geographie')?.coefficientEffectif).toBe(6);

    // Sans spécialité abandonnée déclarée : 100 - coefficient(specialite-abandonnee, 8) = 92.
    // (T18, __tests__/lib/exams-catalog.test.ts, vérifie déjà que la somme de
    // TOUTES les épreuves de la session, abandonnée incluse, vaut 100.)
    expect(carte.totalCoefficientObligatoire).toBe(92);
    expect(carte.necessiteVerificationHumaine).toBe(false);
  });

  test('les deux spécialités du profil remplacent les libellés génériques eds1/eds2', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ specialite1: 'NSI', specialite2: 'MATHS_EXPERTES' }),
      policy: policy2027,
    });
    const libelles = carte.epreuves.map((e) => e.libelle);
    expect(libelles.some((l) => /NSI/i.test(l))).toBe(true);
  });

  test('spécialité abandonnée absente du profil (terminale sans abandon) : épreuve exclue de la carte', () => {
    const carte = genererCarteExamen({ profil: baseProfil({ specialiteAbandonnee: null }), policy: policy2027 });
    expect(carte.epreuves.find((e) => e.code === 'specialite-abandonnee')).toBeUndefined();
  });

  test('spécialité abandonnée présente : épreuve incluse, ponctuelle, A_PRESENTER', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ specialiteAbandonnee: 'SES' }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'specialite-abandonnee');
    expect(ep).toBeDefined();
    expect(ep?.statut).toBe('A_PRESENTER');
    expect(ep?.coefficientEffectif).toBe(8);
    // Avec l'abandonnée incluse, le total obligatoire retrouve l'invariant
    // T18 (somme de toutes les épreuves de la session = 100).
    expect(carte.totalCoefficientObligatoire).toBe(100);
  });
});

describe('genererCarteExamen — P10, première, anticipées seules', () => {
  test('carte ne contient que les 3 épreuves anticipées, toutes A_PRESENTER', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ level: 'PREMIERE', intentionCycleComplet: false }),
      policy: policy2027,
    });
    const codes = carte.epreuves.map((e) => e.code).sort();
    expect(codes).toEqual(['eaf-ecrit', 'eaf-oral', 'eam']);
    expect(carte.epreuves.every((e) => e.statut === 'A_PRESENTER')).toBe(true);
  });
});

describe('genererCarteExamen — dispense de partie pratique', () => {
  test('spécialité NSI : avertissement de dispense présent sur la ligne', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ specialite1: 'NSI', specialite2: 'MATHEMATIQUES' }),
      policy: policy2027,
    });
    const eds = carte.epreuves.find((e) => e.code === 'eds1' && /NSI/i.test(e.libelle));
    expect(eds).toBeDefined();
    expect(eds!.avertissements.some((a) => /dispens/i.test(a))).toBe(true);
  });

  test('spécialité sans partie pratique (ex. SES) : aucun avertissement de dispense', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ specialite1: 'SES', specialite2: 'MATHEMATIQUES' }),
      policy: policy2027,
    });
    const eds = carte.epreuves.find((e) => e.code === 'eds1' && /SES/i.test(e.libelle));
    expect(eds!.avertissements.some((a) => /dispens/i.test(a))).toBe(false);
  });
});

describe('genererCarteExamen — modalité B', () => {
  test('enseignement scientifique (coefficient B confirmé 3+3) résout sans ambiguïté', () => {
    const carte = genererCarteExamen({ profil: baseProfil({ modalite: 'B' }), policy: policy2027 });
    const ep = carte.epreuves.find((e) => e.code === 'enseignement-scientifique');
    expect(ep?.coefficientEffectif).toBe(3);
    expect(ep?.necessiteVerificationHumaine).toBe(false);
  });

  test('HG/LVA/LVB/EMC (coefficient B non confirmé) restent À_VERIFIER, jamais une valeur devinée', () => {
    const carte = genererCarteExamen({ profil: baseProfil({ modalite: 'B' }), policy: policy2027 });
    for (const code of ['histoire-geographie', 'lva', 'lvb', 'emc']) {
      const ep = carte.epreuves.find((e) => e.code === code);
      expect(isAVerifier(ep?.coefficientEffectif)).toBe(true);
      expect(ep?.necessiteVerificationHumaine).toBe(true);
    }
    expect(carte.necessiteVerificationHumaine).toBe(true);
    expect(isAVerifier(carte.totalCoefficientObligatoire)).toBe(true);
  });

  test('EPS reste hors modalité A/B, A_PRESENTER quelle que soit la modalité', () => {
    const carte = genererCarteExamen({ profil: baseProfil({ modalite: 'B' }), policy: policy2027 });
    const eps = carte.epreuves.find((e) => e.code === 'eps');
    expect(eps?.statut).toBe('A_PRESENTER');
    expect(eps?.coefficientEffectif).toBe(6);
  });
});

describe('genererCarteExamen — P5, redoublant terminale avec notes conservées', () => {
  test('note conservée au coefficient identique inter-session : CONSERVEE, coefficient résolu', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026 }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'philosophie');
    expect(ep?.statut).toBe('CONSERVEE');
    expect(ep?.coefficientEffectif).toBe(8);
    expect(ep?.necessiteVerificationHumaine).toBe(false);
  });

  test('note conservée au coefficient divergent inter-session (Grand Oral 2026→2027) : CONSERVEE mais bloquée pour révision humaine, jamais une valeur devinée', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'grand-oral', note: 15, sessionObtention: 2026 }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'grand-oral');
    expect(ep?.statut).toBe('CONSERVEE');
    expect(isAVerifier(ep?.coefficientEffectif)).toBe(true);
    expect(ep?.necessiteVerificationHumaine).toBe(true);
    expect(carte.necessiteVerificationHumaine).toBe(true);
  });

  test('conservation demandée : la carte porte l\'avertissement de perte de mention', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026 }],
      }),
      policy: policy2027,
    });
    expect(carte.avertissementsGeneraux.some((a) => /mention/i.test(a))).toBe(true);
  });

  test('aucune conservation demandée : pas d\'avertissement de perte de mention', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ estRedoublant: true, notesConservees: [] }),
      policy: policy2027,
    });
    expect(carte.avertissementsGeneraux.some((a) => /mention/i.test(a))).toBe(false);
  });
});

describe('genererCarteExamen — options', () => {
  test('option sélectionnée sans coefficient sourcé : ligne présente, À_VERIFIER, révision humaine requise, jamais dans le total obligatoire', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ optionsTerminale: ['DGEMC'] }),
      policy: policy2027,
    });
    const opt = carte.epreuves.find((e) => e.code === 'DGEMC');
    expect(opt).toBeDefined();
    expect(opt?.nature).toBe('OPTION');
    expect(isAVerifier(opt?.coefficientEffectif)).toBe(true);
    expect(opt?.necessiteVerificationHumaine).toBe(true);
  });

  test("alias DGMEC normalisé en DGEMC sur la carte", () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ optionsTerminale: ['DGMEC'] }),
      policy: policy2027,
    });
    expect(carte.epreuves.some((e) => e.code === 'DGEMC')).toBe(true);
    expect(carte.epreuves.some((e) => e.code === 'DGMEC')).toBe(false);
  });

  test('sélection d\'options invalide (Maths expertes + Maths complémentaires) : la carte le signale, révision humaine requise', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ optionsTerminale: ['MATHS_EXPERTES', 'MATHS_COMPLEMENTAIRES'] }),
      policy: policy2027,
    });
    expect(carte.necessiteVerificationHumaine).toBe(true);
    expect(carte.avertissementsGeneraux.some((a) => /exclusiv/i.test(a))).toBe(true);
  });
});

describe('genererCarteExamen — invariants', () => {
  test('fail closed sur une session non vendable', () => {
    expect(() =>
      genererCarteExamen({ profil: baseProfil({ examSession: 2026 }), policy: requireExamPolicy(2026) }),
    ).toThrow(/HISTORICAL_READONLY|not sellable/i);
  });

  test('la carte porte toujours le parcours résolu', () => {
    const carte = genererCarteExamen({ profil: baseProfil(), policy: policy2027 });
    expect(carte.parcours.parcours).toBe('P1_LIBRE_2ANS_MODALITE_A');
  });

  test('P12 (étalement) bloque systématiquement toute émission automatique', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ etalementPlurisessionsDeclare: true }),
      policy: policy2027,
    });
    expect(carte.necessiteVerificationHumaine).toBe(true);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
  });
});
