import { requireExamPolicy } from '@/lib/exams/catalog';
import { genererCarteExamen, P3_COMPRESSION_NON_COUVERTE_CODE } from '@/lib/exams/carte';
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
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
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
        notesConservees: [{ epreuveId: 'grand-oral', note: 15, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
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
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
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
    expect(carte.parcours.parcoursPrincipal).toBe('P1_LIBRE_2ANS_MODALITE_A');
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

describe('genererCarteExamen — statut RECONDUITE, correctif post-revue (mission, 2026-08-25)', () => {
  test('P1/P2 : anticipées à présenter lors de l\'année normale (première, primo-candidat, intentionCycleComplet)', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ level: 'PREMIERE', intentionCycleComplet: true }),
      policy: policy2027,
    });
    expect(carte.parcours.parcoursPrincipal).toBe('P1_LIBRE_2ANS_MODALITE_A');
    for (const code of ['eaf-ecrit', 'eaf-oral', 'eam']) {
      const ep = carte.epreuves.find((e) => e.code === code);
      expect(ep?.statut).toBe('A_PRESENTER');
      expect(ep?.anneePassation).toBe(2027);
    }
    expect(carte.emissionAutomatiqueAutorisee).toBe(true);
  });

  test('P1/P2 : primo-candidat continu en terminale — anticipées RECONDUITE avec coefficient ferme (aucune ambiguïté D. 334-7-1)', () => {
    const carte = genererCarteExamen({ profil: baseProfil({ level: 'TERMINALE' }), policy: policy2027 });
    for (const code of ['eaf-ecrit', 'eaf-oral', 'eam']) {
      const ep = carte.epreuves.find((e) => e.code === code);
      expect(ep?.statut).toBe('RECONDUITE');
      expect(ep?.anneePassation).toBe(2026);
      expect(isAVerifier(ep?.coefficientEffectif)).toBe(false);
      expect(ep?.necessiteVerificationHumaine).toBe(false);
    }
    expect(carte.emissionAutomatiqueAutorisee).toBe(true);
  });

  test('P3 légalement éligible : anticipées présentées la même session que les épreuves finales, pas reconduites — mais émission automatique reste bloquée (mission "vers un produit complet", lot de fermeture P11/P3)', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ level: 'TERMINALE' }),
      policy: policy2027,
      bacAccelereEligibilityAnswers: { age20: true },
    });
    expect(carte.parcours.parcoursPrincipal).toBe('P3_LIBRE_1AN_DEROGATION');
    // La condition légale (eligibilité article 3) EST confirmée...
    expect(carte.parcours.requiresHumanReview).toBe(false);
    for (const code of ['eaf-ecrit', 'eaf-oral', 'eam']) {
      const ep = carte.epreuves.find((e) => e.code === code);
      expect(ep?.statut).toBe('A_PRESENTER');
      expect(ep?.anneePassation).toBe(2027);
    }
    // Le tronc terminal est aussi présent, dans la même session.
    expect(carte.epreuves.find((e) => e.code === 'philosophie')?.statut).toBe('A_PRESENTER');
    // ...mais la question COMMERCIALE (couverture du rythme compressé)
    // reste, elle, entièrement ouverte — une décision de conception
    // séparée, jamais déduite de l'éligibilité légale. Avant ce correctif,
    // ce test attendait `true` ici : un P3 légalement éligible atteignait
    // l'émission automatique avec un volume standard, non compressé,
    // silencieusement sous-dimensionné.
    expect(carte.necessiteVerificationHumaine).toBe(true);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
    expect(carte.blockingReasonCodes).toContain(P3_COMPRESSION_NON_COUVERTE_CODE);
  });

  test('P3 : avertissement honnête sur le rythme compressé — jamais présenté comme une préparation à rythme standard (mission "vers un produit complet" §3), et bloque désormais réellement l\'émission (lot de fermeture P11/P3)', () => {
    const p3Carte = genererCarteExamen({
      profil: baseProfil({ level: 'TERMINALE' }),
      policy: policy2027,
      bacAccelereEligibilityAnswers: { age20: true },
    });
    expect(p3Carte.avertissementsGeneraux.some((a) => a.includes('P3') && a.includes('rythme'))).toBe(true);
    expect(p3Carte.avertissementsGeneraux.some((a) => a.includes('accompagnement renforcé'))).toBe(true);
    expect(p3Carte.necessiteVerificationHumaine).toBe(true);
    expect(p3Carte.emissionAutomatiqueAutorisee).toBe(false);
    expect(p3Carte.blockingReasonCodes).toEqual([P3_COMPRESSION_NON_COUVERTE_CODE]);

    // Un P1 nominal (même profil, sans dérogation) ne porte jamais cet
    // avertissement — il est spécifique à la compression P3, pas un texte
    // générique ajouté à toutes les cartes — et n'est jamais bloqué par ce
    // code précis.
    const p1Carte = genererCarteExamen({ profil: baseProfil({ level: 'TERMINALE' }), policy: policy2027 });
    expect(p1Carte.avertissementsGeneraux.some((a) => a.includes('P3'))).toBe(false);
    expect(p1Carte.blockingReasonCodes).not.toContain(P3_COMPRESSION_NON_COUVERTE_CODE);
    expect(p1Carte.emissionAutomatiqueAutorisee).toBe(true);
  });

  test('P3 avec éligibilité réglementaire confirmée MAIS périmètre commercial absent : le blocage est permanent, jamais contournable par un module ordinaire sélectionné ailleurs (mission §3, lot de fermeture)', () => {
    // Même un P3 avec des modules "ordinaires" par ailleurs (spécialités
    // standard, pas de dispense) reste bloqué — le gate ne dépend d'aucune
    // autre condition que isBacAccelere lui-même.
    const carte = genererCarteExamen({
      profil: baseProfil({ level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' }),
      policy: policy2027,
      bacAccelereEligibilityAnswers: { age20: true },
    });
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
    expect(carte.necessiteVerificationHumaine).toBe(true);
  });

  test('P3 également accessible depuis un profil renseigné en Première (pas d\'année antérieure à raisonner pour un bac accéléré)', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ level: 'PREMIERE' }),
      policy: policy2027,
      bacAccelereEligibilityAnswers: { age20: true },
    });
    expect(carte.parcours.parcoursPrincipal).toBe('P3_LIBRE_1AN_DEROGATION');
    // Contrairement à P10, la carte contient aussi le tronc terminal.
    expect(carte.epreuves.find((e) => e.code === 'philosophie')).toBeDefined();
    expect(carte.epreuves.find((e) => e.code === 'eds1')).toBeDefined();
  });

  test('P3 non confirmé (condition non auto-vérifiable) : émission automatique bloquée', () => {
    const carte = genererCarteExamen({
      profil: baseProfil(),
      policy: policy2027,
      bacAccelereEligibilityAnswers: { force_majeure: true },
    });
    expect(carte.parcours.parcoursPrincipal).toBe('P3_LIBRE_1AN_DEROGATION');
    expect(carte.parcours.requiresHumanReview).toBe(true);
    expect(carte.necessiteVerificationHumaine).toBe(true);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
  });

  test('P4 : reprise de Première — anticipées à repasser (A_PRESENTER), jamais reconduites', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ level: 'PREMIERE', estRedoublant: true }),
      policy: policy2027,
    });
    expect(carte.parcours.parcoursPrincipal).toBe('P4_REDOUBLEMENT_PREMIERE');
    for (const code of ['eaf-ecrit', 'eaf-oral', 'eam']) {
      const ep = carte.epreuves.find((e) => e.code === code);
      expect(ep?.statut).toBe('A_PRESENTER');
    }
    expect(carte.emissionAutomatiqueAutorisee).toBe(true);
  });

  test('P5 : note anticipée effectivement reconduite lorsque le candidat la déclare explicitement (D. 334-13) et que le seuil est atteint', () => {
    // eaf-ecrit/eaf-oral ont le même coefficient (5) en 2026 et 2027 — pas
    // d'ambiguïté de divergence. eam est volontairement absent de cette
    // déclaration : il n'existait pas en 2026 (introduit en 2027), donc une
    // note "eam" antérieure à 2027 est régulièrement impossible — ce cas
    // est couvert séparément par le test de divergence ci-dessous.
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [
          { epreuveId: 'eaf-ecrit', note: 13, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' },
          { epreuveId: 'eaf-oral', note: 12, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' },
        ],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'eaf-ecrit');
    expect(ep?.statut).toBe('CONSERVEE');
    expect(ep?.coefficientEffectif).toBe(5);
    expect(ep?.necessiteVerificationHumaine).toBe(false);
    for (const code of ['eaf-ecrit', 'eaf-oral']) {
      expect(carte.epreuves.find((e) => e.code === code)?.statut).toBe('CONSERVEE');
      expect(carte.epreuves.find((e) => e.code === code)?.necessiteVerificationHumaine).toBe(false);
    }
    // eam, non déclaré, reste fail-closed (redoublant sans déclaration) —
    // c'est ce qui empêche encore l'émission automatique ici.
    expect(carte.epreuves.find((e) => e.code === 'eam')?.statut).toBe('RECONDUITE');
    expect(carte.epreuves.find((e) => e.code === 'eam')?.necessiteVerificationHumaine).toBe(true);
  });

  test('P5 : renonciation déclarée (redoublant, aucune note déclarée pour l\'anticipée) — fail closed, jamais une reconduction devinée', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ estRedoublant: true, notesConservees: [] }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'eaf-ecrit');
    expect(ep?.statut).toBe('RECONDUITE');
    expect(isAVerifier(ep?.coefficientEffectif)).toBe(true);
    expect(ep?.necessiteVerificationHumaine).toBe(true);
    expect(ep?.avertissements.some((a) => /D\. 334-7-1/.test(a))).toBe(true);
    expect(carte.necessiteVerificationHumaine).toBe(true);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
  });

  test('troisième candidature (ou plus) : le profil ne distingue pas le nombre de tentatives — reste fail closed comme toute redoublance, jamais moins prudent', () => {
    // ProfilCandidat.estRedoublant est un booléen, pas un compteur : la carte
    // ne peut donc pas distinguer une 2e d'une 3e+ candidature. C'est
    // délibéré (voir commentaire de buildAnticipeeLine) — le comportement
    // fail-closed s'applique uniformément, jamais relâché faute de savoir.
    const carte = genererCarteExamen({
      profil: baseProfil({ estRedoublant: true, notesConservees: [] }),
      policy: policy2027,
    });
    expect(carte.epreuves.find((e) => e.code === 'eaf-ecrit')?.necessiteVerificationHumaine).toBe(true);
  });

  test('résultat antérieur inférieur à 10 : le seuil de conservation D. 334-13 ne s\'applique pas, l\'épreuve doit être représentée', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'eaf-ecrit', note: 8, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'eaf-ecrit');
    expect(ep?.statut).toBe('A_PRESENTER');
    expect(ep?.avertissements.some((a) => /seuil de conservation/.test(a))).toBe(true);
  });

  test('note absente ou invalide (hors barème 0-20) : traitée comme à présenter, jamais acceptée silencieusement', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'eaf-ecrit', note: 27, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'eaf-ecrit');
    expect(ep?.statut).toBe('A_PRESENTER');
    expect(ep?.avertissements.some((a) => /invalide/.test(a))).toBe(true);
  });

  test('situation ambiguë (bascule scolaire, brancheBascule renseignée) : validation humaine obligatoire pour les anticipées', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'eaf-ecrit');
    expect(ep?.statut).toBe('RECONDUITE');
    expect(ep?.necessiteVerificationHumaine).toBe(true);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
  });

  test('changement de coefficient entre session d\'origine et session cible pour une anticipée déclarée conservée : jamais une valeur devinée', () => {
    // eam n'existe pas en 2026 (introduit en 2027) — un candidat qui déclare
    // une note "eam" obtenue en 2026 pointe vers une épreuve inexistante
    // cette année-là : resolveConservedNoteCoefficient doit refuser de
    // deviner, pas planter ni inventer un coefficient.
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'eam', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'eam');
    expect(ep?.statut).toBe('CONSERVEE');
    expect(isAVerifier(ep?.coefficientEffectif)).toBe(true);
    expect(ep?.necessiteVerificationHumaine).toBe(true);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
  });

  test('absence de double comptage entre RECONDUITE et CONSERVEE : chaque épreuve anticipée n\'apparaît qu\'une seule fois sur la carte', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'eaf-ecrit', note: 13, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
      policy: policy2027,
    });
    const anticipeeCodes = carte.epreuves.filter((e) => e.nature === 'ANTICIPEE').map((e) => e.code);
    expect(new Set(anticipeeCodes).size).toBe(anticipeeCodes.length);
    // eaf-ecrit est CONSERVEE ; eaf-oral et eam (non déclarés) sont RECONDUITE fail-closed — jamais les deux statuts sur la même ligne.
    expect(carte.epreuves.find((e) => e.code === 'eaf-ecrit')?.statut).toBe('CONSERVEE');
    expect(carte.epreuves.filter((e) => e.code === 'eaf-ecrit')).toHaveLength(1);
  });

  test('mecanisme RECONDUCTION_AUTOMATIQUE_CONFIRMEE (D. 334-7-1) + audit VERIFIEE : statut RECONDUITE avec coefficient résolu, pas de perte de mention', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [
          {
            epreuveId: 'philosophie',
            note: 6,
            sessionObtention: 2026,
            mecanisme: 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE',
            reconductionAudit: {
              mecanismeDeclare: 'RECONDUCTION_AUTOMATIQUE_DECLAREE',
              statutVerification: 'VERIFIEE',
              validateurUserId: 'staff-1',
              dateValidation: '2026-08-26',
              sourceReglementaire: 'Article D. 334-7-1',
              sessionOrigine: 2026,
              sessionCible: 2027,
            },
          },
        ],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'philosophie');
    // D. 334-7-1 n'a pas de seuil 10/20 (contrairement à D. 334-13) : une
    // note de 6 reste RECONDUITE, pas rejetée.
    expect(ep?.statut).toBe('RECONDUITE');
    expect(ep?.coefficientEffectif).toBe(8);
    expect(ep?.necessiteVerificationHumaine).toBe(false);
    // Pas de conservation "sur demande" ici : aucune perte de mention à signaler.
    expect(carte.avertissementsGeneraux.some((a) => /mention/i.test(a))).toBe(false);
  });

  test('mecanisme RECONDUCTION_AUTOMATIQUE_CONFIRMEE SANS audit vérifié (ADR Gate 1) : fail-closed, jamais confirmé à partir de mecanisme seul', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [
          { epreuveId: 'philosophie', note: 6, sessionObtention: 2026, mecanisme: 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE' },
        ],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'philosophie');
    expect(ep?.statut).toBe('RECONDUITE');
    expect(ep?.coefficientEffectif).toBe('À_VERIFIER');
    expect(ep?.necessiteVerificationHumaine).toBe(true);
    expect(ep?.avertissements.some((a) => a.includes('non vérifiée par un membre du personnel'))).toBe(true);
  });

  test('mecanisme RECONDUCTION_AUTOMATIQUE_CONFIRMEE + audit REFUSEE ou NON_VERIFIEE : reste fail-closed', () => {
    for (const statutVerification of ['NON_VERIFIEE', 'REFUSEE'] as const) {
      const carte = genererCarteExamen({
        profil: baseProfil({
          estRedoublant: true,
          notesConservees: [
            {
              epreuveId: 'philosophie',
              note: 6,
              sessionObtention: 2026,
              mecanisme: 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE',
              reconductionAudit: { mecanismeDeclare: 'RECONDUCTION_AUTOMATIQUE_DECLAREE', statutVerification },
            },
          ],
        }),
        policy: policy2027,
      });
      const ep = carte.epreuves.find((e) => e.code === 'philosophie');
      expect(ep?.necessiteVerificationHumaine).toBe(true);
    }
  });

  test('mecanisme INDETERMINE : note connue mais mécanisme non tranché — fail closed avec avertissement spécifique, distinct du cas "rien de déclaré"', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'INDETERMINE' }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'philosophie');
    expect(ep?.statut).toBe('RECONDUITE');
    expect(isAVerifier(ep?.coefficientEffectif)).toBe(true);
    expect(ep?.necessiteVerificationHumaine).toBe(true);
    expect(ep?.avertissements.some((a) => /mécanisme applicable/.test(a))).toBe(true);
  });
});

describe('genererCarteExamen — dispenses déclarées (P7), jamais un statut définitif sans validation humaine', () => {
  test('épreuve déclarée dispensée par un titulaire du bac : statut DISPENSEE, jamais définitif, révision humaine requise, émission bloquée', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [{ epreuveId: 'philosophie', statut: 'DECLAREE' }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'philosophie');
    expect(ep?.statut).toBe('DISPENSEE');
    expect(ep?.necessiteVerificationHumaine).toBe(true);
    expect(ep?.avertissements.some((a) => /DÉCLARÉE/.test(a))).toBe(true);
    expect(carte.necessiteVerificationHumaine).toBe(true);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
    // Le total obligatoire reste incertain tant que la dispense n'est pas validée.
    expect(isAVerifier(carte.totalCoefficientObligatoire)).toBe(true);
  });

  test('code de dispense déclaré sans épreuve correspondante sur la carte : signalé en avertissement général, jamais ignoré silencieusement', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [{ epreuveId: 'epreuve-inexistante', statut: 'DECLAREE' }],
      }),
      policy: policy2027,
    });
    expect(carte.avertissementsGeneraux.some((a) => /epreuve-inexistante/.test(a))).toBe(true);
  });

  test('aucune dispense déclarée : aucune ligne DISPENSEE, comportement inchangé', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({ estTitulaireBacDejaObtenu: true }),
      policy: policy2027,
    });
    expect(carte.epreuves.some((e) => e.statut === 'DISPENSEE')).toBe(false);
  });

  test('dispense CONFIRMEE (vérifiée par un humain) : DISPENSEE définitif, plus de revue humaine requise sur cette ligne, exclue du total', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [{ epreuveId: 'philosophie', statut: 'CONFIRMEE' }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'philosophie');
    expect(ep?.statut).toBe('DISPENSEE');
    expect(ep?.necessiteVerificationHumaine).toBe(false);
    expect(ep?.avertissements.some((a) => /confirmée/i.test(a))).toBe(true);
    // P7 lui-même n'a plus besoin de revue humaine puisque la seule
    // dispense déclarée est déjà confirmée.
    expect(carte.parcours.requiresHumanReview).toBe(false);
  });

  test('dispense REFUSEE : l\'épreuve reste A_PRESENTER, avertissement informatif conservé', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [{ epreuveId: 'philosophie', statut: 'REFUSEE' }],
      }),
      policy: policy2027,
    });
    const ep = carte.epreuves.find((e) => e.code === 'philosophie');
    expect(ep?.statut).toBe('A_PRESENTER');
    expect(ep?.avertissements.some((a) => /écartée/i.test(a))).toBe(true);
  });

  test('mélange DECLAREE + CONFIRMEE : le total reste À_VERIFIER tant qu\'au moins une dispense n\'est pas confirmée', () => {
    const carte = genererCarteExamen({
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [
          { epreuveId: 'philosophie', statut: 'CONFIRMEE' },
          { epreuveId: 'grand-oral', statut: 'DECLAREE' },
        ],
      }),
      policy: policy2027,
    });
    expect(isAVerifier(carte.totalCoefficientObligatoire)).toBe(true);
    expect(carte.emissionAutomatiqueAutorisee).toBe(false);
  });
});
