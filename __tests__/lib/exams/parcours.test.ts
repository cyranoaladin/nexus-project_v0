import { requireExamPolicy } from '@/lib/exams/catalog';
import { resolveParcoursType, type ProfilCandidatInput } from '@/lib/exams/parcours';

const policy2027 = requireExamPolicy(2027);

function baseProfil(overrides: Partial<ProfilCandidatInput> = {}): ProfilCandidatInput {
  return {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'NSI',
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

describe('resolveParcoursType — cas nominaux (un par parcours)', () => {
  test('P1: terminale, modalité A, primo-candidat', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ modalite: 'A' }) });
    expect(r.parcours).toBe('P1_LIBRE_2ANS_MODALITE_A');
    expect(r.requiresHumanReview).toBe(false);
    expect(r.changementSpecialite).toBe(false);
  });

  test('P2: terminale, modalité B, primo-candidat', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ modalite: 'B' }) });
    expect(r.parcours).toBe('P2_LIBRE_2ANS_MODALITE_B');
  });

  test('P3: bac accéléré, éligible (condition auto-vérifiable confirmée)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil(),
      bacAccelereEligibilityAnswers: { age20: true },
    });
    expect(r.parcours).toBe('P3_LIBRE_1AN_DEROGATION');
    expect(r.requiresHumanReview).toBe(false);
  });

  test('P4: redoublement niveau première', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ level: 'PREMIERE', estRedoublant: true }),
    });
    expect(r.parcours).toBe('P4_REDOUBLEMENT_PREMIERE');
  });

  test('P5: redoublement terminale, sans intention d\'amélioration', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estRedoublant: true, intentionAmelioration: false }),
    });
    expect(r.parcours).toBe('P5_REDOUBLEMENT_TERMINALE');
  });

  test('P6: amélioration + terminale', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estRedoublant: true, intentionAmelioration: true }),
    });
    expect(r.parcours).toBe('P6_AMELIORATION_ET_TERMINALE');
  });

  test('P7: titulaire du bac déjà obtenu', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true }),
    });
    expect(r.parcours).toBe('P7_TITULAIRE_BAC');
  });

  test('P8: bascule scolaire vers individuel', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' }),
    });
    expect(r.parcours).toBe('P8_SCOLARISE_VERS_LIBRE');
  });

  test('P10: épreuves anticipées seules (première, sans engagement cycle complet)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ level: 'PREMIERE', intentionCycleComplet: false }),
    });
    expect(r.parcours).toBe('P10_EPREUVES_ANTICIPEES_SEULES');
  });

  test('P11: second groupe (rattrapage)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ moyenneRattrapage: 9 }),
    });
    expect(r.parcours).toBe('P11_SECOND_GROUPE');
  });

  test('P12: étalement plurisessions déclaré — manuel assisté, révision humaine obligatoire', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ etalementPlurisessionsDeclare: true }),
    });
    expect(r.parcours).toBe('P12_ETALEMENT_PLURISESSIONS');
    expect(r.requiresHumanReview).toBe(true);
  });
});

describe('resolveParcoursType — cas combinatoires (mission §14)', () => {
  test('P5 avec notes conservées', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        intentionAmelioration: false,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026 }],
      }),
    });
    expect(r.parcours).toBe('P5_REDOUBLEMENT_TERMINALE');
  });

  test('P5 avec renonciation (aucune note conservée déclarée)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estRedoublant: true, intentionAmelioration: false, notesConservees: [] }),
    });
    expect(r.parcours).toBe('P5_REDOUBLEMENT_TERMINALE');
  });

  test('P8 branche conservation des moyennes de première', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' }),
    });
    expect(r.parcours).toBe('P8_SCOLARISE_VERS_LIBRE');
  });

  test('P8 branche renonciation aux moyennes de première', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ brancheBascule: 'RENONCIATION_MOYENNES_PREMIERE' }),
    });
    expect(r.parcours).toBe('P8_SCOLARISE_VERS_LIBRE');
  });

  test('P9 combiné avec un parcours principal (P1 + changement de spécialité)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ modalite: 'A', changementSpecialite: true }),
    });
    expect(r.parcours).toBe('P1_LIBRE_2ANS_MODALITE_A');
    expect(r.changementSpecialite).toBe(true);
  });

  test('P9 combiné avec un redoublement (P5 + changement de spécialité)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estRedoublant: true, changementSpecialite: true }),
    });
    expect(r.parcours).toBe('P5_REDOUBLEMENT_TERMINALE');
    expect(r.changementSpecialite).toBe(true);
  });

  test('P3 éligible', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil(),
      bacAccelereEligibilityAnswers: { deja_titulaire_bac: true },
    });
    expect(r.parcours).toBe('P3_LIBRE_1AN_DEROGATION');
    expect(r.requiresHumanReview).toBe(false);
  });

  test('P3 non éligible (toutes les conditions auto-vérifiables explicitement infirmées) retombe sur le parcours standard', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ modalite: 'B' }),
      bacAccelereEligibilityAnswers: {
        age20: false,
        enfant_charge: false,
        echec_anterieur: false,
        deja_titulaire_bac: false,
        diplome_etranger_comparable: false,
      },
    });
    expect(r.parcours).toBe('P2_LIBRE_2ANS_MODALITE_B');
    expect(r.requiresHumanReview).toBe(false);
  });

  test('P3 nécessitant une révision humaine (condition non vérifiable automatiquement confirmée) bloque le parcours, ne retombe jamais silencieusement', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil(),
      bacAccelereEligibilityAnswers: { force_majeure: true },
    });
    expect(r.parcours).toBe('P3_LIBRE_1AN_DEROGATION');
    expect(r.requiresHumanReview).toBe(true);
  });

  test('P7 avec dispenses partielles déclarées', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true, epreuvesDispenseesDeclarees: ['philosophie'] }),
    });
    expect(r.parcours).toBe('P7_TITULAIRE_BAC');
    // Toute dispense déclarative (non vérifiable par Nexus) exige une revue humaine.
    expect(r.requiresHumanReview).toBe(true);
  });

  test('P11 second groupe', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ moyenneRattrapage: 8.5 }) });
    expect(r.parcours).toBe('P11_SECOND_GROUPE');
  });

  test('P12 manuel — jamais résolu automatiquement même combiné à d\'autres faits', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ etalementPlurisessionsDeclare: true, estRedoublant: true }),
    });
    expect(r.parcours).toBe('P12_ETALEMENT_PLURISESSIONS');
    expect(r.requiresHumanReview).toBe(true);
  });
});

describe('resolveParcoursType — invariants', () => {
  test('un profil ne résout jamais à plus d\'un ParcoursType — la fonction retourne toujours exactement un code', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil() });
    expect(typeof r.parcours).toBe('string');
  });

  test('session non vendable (2026, historique) refuse de résoudre un parcours — fail closed', () => {
    expect(() =>
      resolveParcoursType(requireExamPolicy(2026), { profil: baseProfil({ examSession: 2026 }) }),
    ).toThrow(/HISTORICAL_READONLY|not sellable/i);
  });

  test('moyenneRattrapage hors plage réglementaire (8-10) ne déclenche pas P11 silencieusement', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ moyenneRattrapage: 5 }) });
    expect(r.parcours).not.toBe('P11_SECOND_GROUPE');
  });

  test('priorité documentée : P12 (étalement) domine tout le reste, y compris P7/P11', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({
        etalementPlurisessionsDeclare: true,
        estTitulaireBacDejaObtenu: true,
        moyenneRattrapage: 9,
      }),
    });
    expect(r.parcours).toBe('P12_ETALEMENT_PLURISESSIONS');
  });

  test('priorité documentée : P7 (titulaire) domine P4/P5/P6 (redoublement)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true, estRedoublant: true }),
    });
    expect(r.parcours).toBe('P7_TITULAIRE_BAC');
  });
});
