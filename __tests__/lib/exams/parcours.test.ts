import { requireExamPolicy } from '@/lib/exams/catalog';
import {
  deriveEligibilityAnswersFromAudit,
  resolveParcoursType,
  type P3EligibiliteAudit,
  type ProfilCandidatInput,
} from '@/lib/exams/parcours';

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
    expect(r.parcoursPrincipal).toBe('P1_LIBRE_2ANS_MODALITE_A');
    expect(r.requiresHumanReview).toBe(false);
    expect(r.modificateurs.find((m) => m.code === 'P9_CHANGEMENT_SPECIALITE')?.actif).toBe(false);
  });

  test('P2: terminale, modalité B, primo-candidat', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ modalite: 'B' }) });
    expect(r.parcoursPrincipal).toBe('P2_LIBRE_2ANS_MODALITE_B');
  });

  test('P3: bac accéléré, éligible (condition auto-vérifiable confirmée)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil(),
      bacAccelereEligibilityAnswers: { age20: true },
    });
    expect(r.parcoursPrincipal).toBe('P3_LIBRE_1AN_DEROGATION');
    expect(r.requiresHumanReview).toBe(false);
  });

  test('P4: redoublement niveau première', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ level: 'PREMIERE', estRedoublant: true }),
    });
    expect(r.parcoursPrincipal).toBe('P4_REDOUBLEMENT_PREMIERE');
  });

  test('P5: redoublement terminale, sans intention d\'amélioration', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estRedoublant: true, intentionAmelioration: false }),
    });
    expect(r.parcoursPrincipal).toBe('P5_REDOUBLEMENT_TERMINALE');
  });

  test('P6: amélioration + terminale', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estRedoublant: true, intentionAmelioration: true }),
    });
    expect(r.parcoursPrincipal).toBe('P6_AMELIORATION_ET_TERMINALE');
  });

  test('P7: titulaire du bac déjà obtenu', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true }),
    });
    expect(r.parcoursPrincipal).toBe('P7_TITULAIRE_BAC');
  });

  test('P8: bascule scolaire vers individuel', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' }),
    });
    expect(r.parcoursPrincipal).toBe('P8_SCOLARISE_VERS_LIBRE');
  });

  test('P10: épreuves anticipées seules (première, sans engagement cycle complet)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ level: 'PREMIERE', intentionCycleComplet: false }),
    });
    expect(r.parcoursPrincipal).toBe('P10_EPREUVES_ANTICIPEES_SEULES');
  });

  test('P11: second groupe (rattrapage)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ moyenneRattrapage: 9 }),
    });
    expect(r.parcoursPrincipal).toBe('P11_SECOND_GROUPE');
  });

  test('P12: étalement plurisessions déclaré — manuel assisté, révision humaine obligatoire', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ etalementPlurisessionsDeclare: true }),
    });
    expect(r.parcoursPrincipal).toBe('P12_ETALEMENT_PLURISESSIONS');
    expect(r.requiresHumanReview).toBe(true);
  });
});

describe('resolveParcoursType — cas combinatoires (mission §14)', () => {
  test('P5 avec notes conservées', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        intentionAmelioration: false,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    expect(r.parcoursPrincipal).toBe('P5_REDOUBLEMENT_TERMINALE');
  });

  test('P5 avec renonciation (aucune note conservée déclarée)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estRedoublant: true, intentionAmelioration: false, notesConservees: [] }),
    });
    expect(r.parcoursPrincipal).toBe('P5_REDOUBLEMENT_TERMINALE');
  });

  test('P8 branche conservation des moyennes de première', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' }),
    });
    expect(r.parcoursPrincipal).toBe('P8_SCOLARISE_VERS_LIBRE');
  });

  test('P8 branche renonciation aux moyennes de première', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ brancheBascule: 'RENONCIATION_MOYENNES_PREMIERE' }),
    });
    expect(r.parcoursPrincipal).toBe('P8_SCOLARISE_VERS_LIBRE');
  });

  test('P9 combiné avec un parcours principal (P1 + changement de spécialité)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ modalite: 'A', changementSpecialite: true }),
    });
    expect(r.parcoursPrincipal).toBe('P1_LIBRE_2ANS_MODALITE_A');
    expect(r.modificateurs.find((m) => m.code === 'P9_CHANGEMENT_SPECIALITE')?.actif).toBe(true);
  });

  test('P9 combiné avec un redoublement (P5 + changement de spécialité)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estRedoublant: true, changementSpecialite: true }),
    });
    expect(r.parcoursPrincipal).toBe('P5_REDOUBLEMENT_TERMINALE');
    expect(r.modificateurs.find((m) => m.code === 'P9_CHANGEMENT_SPECIALITE')?.actif).toBe(true);
  });

  test('P3 éligible', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil(),
      bacAccelereEligibilityAnswers: { deja_titulaire_bac: true },
    });
    expect(r.parcoursPrincipal).toBe('P3_LIBRE_1AN_DEROGATION');
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
    expect(r.parcoursPrincipal).toBe('P2_LIBRE_2ANS_MODALITE_B');
    expect(r.requiresHumanReview).toBe(false);
  });

  test('P3 nécessitant une révision humaine (condition non vérifiable automatiquement confirmée) bloque le parcours, ne retombe jamais silencieusement', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil(),
      bacAccelereEligibilityAnswers: { force_majeure: true },
    });
    expect(r.parcoursPrincipal).toBe('P3_LIBRE_1AN_DEROGATION');
    expect(r.requiresHumanReview).toBe(true);
  });

  test('P7 avec dispenses partielles déclarées', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true, dispensesDeclarees: [{ epreuveId: 'philosophie', statut: 'DECLAREE' }] }),
    });
    expect(r.parcoursPrincipal).toBe('P7_TITULAIRE_BAC');
    // Toute dispense déclarative (non vérifiable par Nexus) exige une revue humaine.
    expect(r.requiresHumanReview).toBe(true);
  });

  test('P11 second groupe', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ moyenneRattrapage: 8.5 }) });
    expect(r.parcoursPrincipal).toBe('P11_SECOND_GROUPE');
  });

  test('P12 manuel — jamais résolu automatiquement même combiné à d\'autres faits', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ etalementPlurisessionsDeclare: true, estRedoublant: true }),
    });
    expect(r.parcoursPrincipal).toBe('P12_ETALEMENT_PLURISESSIONS');
    expect(r.requiresHumanReview).toBe(true);
  });
});

describe('resolveParcoursType — invariants', () => {
  test('un profil ne résout jamais à plus d\'un ParcoursType — la fonction retourne toujours exactement un code', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil() });
    expect(typeof r.parcoursPrincipal).toBe('string');
  });

  test('session non vendable (2026, historique) refuse de résoudre un parcours — fail closed', () => {
    expect(() =>
      resolveParcoursType(requireExamPolicy(2026), { profil: baseProfil({ examSession: 2026 }) }),
    ).toThrow(/HISTORICAL_READONLY|not sellable/i);
  });

  test('moyenneRattrapage hors plage réglementaire (8-10) ne déclenche pas P11 silencieusement', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ moyenneRattrapage: 5 }) });
    expect(r.parcoursPrincipal).not.toBe('P11_SECOND_GROUPE');
  });

  test('priorité documentée : P12 (étalement) domine tout le reste, y compris P7/P11', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({
        etalementPlurisessionsDeclare: true,
        estTitulaireBacDejaObtenu: true,
        moyenneRattrapage: 9,
      }),
    });
    expect(r.parcoursPrincipal).toBe('P12_ETALEMENT_PLURISESSIONS');
  });

  test('priorité documentée : P7 (titulaire) domine P4/P5/P6 (redoublement)', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true, estRedoublant: true }),
    });
    expect(r.parcoursPrincipal).toBe('P7_TITULAIRE_BAC');
  });

  test('policy avec bornes secondGroupe inversées lève une erreur (fail closed)', () => {
    const rules = policy2027.candidatIndividuelRules;
    if (!rules || typeof rules !== 'object') {
      throw new Error('2027 exam policy fixture must define candidatIndividuelRules object');
    }
    const invalidPolicy = {
      ...policy2027,
      candidatIndividuelRules: {
        ...rules,
        secondGroupe: {
          moyenneMin: 10,
          moyenneMax: 8,
          nombreDisciplines: 2,
          note: 'Invalid reversed bounds',
        },
      },
    } as any;
    expect(() =>
      resolveParcoursType(invalidPolicy, { profil: baseProfil({ moyenneRattrapage: 9 }) }),
    ).toThrow(/Invalid secondGroupe policy bounds/);
  });
});

describe('resolveParcoursType — conflits entre parcours, rien n\'est perdu silencieusement (mission §4)', () => {
  test('un titulaire relevant aussi d\'un second groupe après une nouvelle présentation : P11 gagne, P7 apparaît en fait concurrent avec sa propre raison', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true, moyenneRattrapage: 9 }),
    });
    expect(r.parcoursPrincipal).toBe('P11_SECOND_GROUPE');
    expect(r.faitsConcurrents.map((f) => f.parcours)).toContain('P7_TITULAIRE_BAC');
    expect(r.faitsConcurrents).toHaveLength(2); // P7 et le P1/P2 par défaut
    expect(r.raisonChoixPrincipal).toMatch(/P11_SECOND_GROUPE/);
  });

  test('changement de spécialité accompagnant P3 (bac accéléré) : le modificateur reste actif indépendamment du parcours principal retenu', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ changementSpecialite: true }),
      bacAccelereEligibilityAnswers: { age20: true },
    });
    expect(r.parcoursPrincipal).toBe('P3_LIBRE_1AN_DEROGATION');
    expect(r.modificateurs.find((m) => m.code === 'P9_CHANGEMENT_SPECIALITE')?.actif).toBe(true);
  });

  test('changement de spécialité accompagnant P8 (bascule) : modificateur toujours porté, jamais absorbé par le parcours principal', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ brancheBascule: 'RENONCIATION_MOYENNES_PREMIERE', changementSpecialite: true }),
    });
    expect(r.parcoursPrincipal).toBe('P8_SCOLARISE_VERS_LIBRE');
    expect(r.modificateurs.find((m) => m.code === 'P9_CHANGEMENT_SPECIALITE')?.actif).toBe(true);
  });

  test('redoublant avec notes conservées ET changement de spécialité : P5 retenu, P9 actif, rien n\'est perdu', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        changementSpecialite: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 12, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    expect(r.parcoursPrincipal).toBe('P5_REDOUBLEMENT_TERMINALE');
    expect(r.modificateurs.find((m) => m.code === 'P9_CHANGEMENT_SPECIALITE')?.actif).toBe(true);
  });

  test('P8 et P4 en conflit (bascule renseignée ET redoublement de première déclarés ensemble) : P8 gagne (priorité documentée), P4 reste visible en fait concurrent', () => {
    const r = resolveParcoursType(policy2027, {
      profil: baseProfil({ level: 'PREMIERE', brancheBascule: 'RENONCIATION_MOYENNES_PREMIERE', estRedoublant: true }),
    });
    expect(r.parcoursPrincipal).toBe('P8_SCOLARISE_VERS_LIBRE');
    expect(r.faitsConcurrents.map((f) => f.parcours)).toContain('P4_REDOUBLEMENT_PREMIERE');
  });

  test('le cas par défaut (P1/P2) apparaît toujours comme fait concurrent quand un autre parcours gagne — jamais silencieusement absent', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ estTitulaireBacDejaObtenu: true }) });
    expect(r.parcoursPrincipal).toBe('P7_TITULAIRE_BAC');
    expect(r.faitsConcurrents.map((f) => f.parcours)).toContain('P1_LIBRE_2ANS_MODALITE_A');
  });

  test('aucun conflit (profil P1 pur) : faitsConcurrents est vide, la raison le dit explicitement', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil() });
    expect(r.faitsConcurrents).toHaveLength(0);
    expect(r.raisonChoixPrincipal).toMatch(/seule situation/);
  });

  test('reglesPrioriteAppliquees documente toujours l\'ordre utilisé, quel que soit le résultat', () => {
    const r = resolveParcoursType(policy2027, { profil: baseProfil({ estRedoublant: true }) });
    expect(r.reglesPrioriteAppliquees).toMatch(/P12.*P11.*P7.*P8/);
  });
});

describe('deriveEligibilityAnswersFromAudit — ADR-dette-reconduction-p3-gates.md Gate 2', () => {
  test('aucun audit -> undefined (P3 jamais exploré, jamais confondu avec "non éligible")', () => {
    expect(deriveEligibilityAnswersFromAudit(undefined)).toBeUndefined();
    expect(deriveEligibilityAnswersFromAudit(null)).toBeUndefined();
    expect(deriveEligibilityAnswersFromAudit([])).toBeUndefined();
  });

  test('decision CONFIRMEE -> true ; decision REFUSEE -> false ; EN_ATTENTE -> non renseigné', () => {
    const audit: P3EligibiliteAudit[] = [
      { motif: 'age20', faitsDeclares: true, justificatifRequis: false, justificatifValide: true, decision: 'CONFIRMEE', sourceReglementaire: 'x' },
      { motif: 'echec_anterieur', faitsDeclares: true, justificatifRequis: true, justificatifValide: false, decision: 'REFUSEE', sourceReglementaire: 'x' },
      { motif: 'retour_formation', faitsDeclares: true, justificatifRequis: true, justificatifValide: false, decision: 'EN_ATTENTE', sourceReglementaire: 'x' },
    ];
    const answers = deriveEligibilityAnswersFromAudit(audit);
    expect(answers?.age20).toBe(true);
    expect(answers?.echec_anterieur).toBe(false);
    expect(answers?.retour_formation).toBeUndefined();
  });

  test('faitsDeclares seul (sans decision CONFIRMEE) ne produit jamais true — la famille ne peut pas se confirmer elle-même', () => {
    const audit: P3EligibiliteAudit[] = [
      { motif: 'age20', faitsDeclares: true, justificatifRequis: false, justificatifValide: false, decision: 'EN_ATTENTE', sourceReglementaire: 'x' },
    ];
    expect(deriveEligibilityAnswersFromAudit(audit)?.age20).toBeUndefined();
  });
});
