import { requireExamPolicy } from '@/lib/exams/catalog';
import { validateProfilCandidat } from '@/lib/exams/profile-validation';
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

describe('validateProfilCandidat — session (nominal, bloquant, source, propagation)', () => {
  test('nominal : session active, aucune erreur', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil() });
    expect(result.valide).toBe(true);
    expect(result.erreurs).toHaveLength(0);
    expect(result.emissionAutomatiqueAutorisee).toBe(true);
  });

  test('bloquant : session non supportée', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ examSession: 2099 }) });
    const issue = result.erreurs.find((i) => i.code === 'SESSION_NON_SUPPORTEE');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
    expect(result.valide).toBe(false);
    expect(result.emissionAutomatiqueAutorisee).toBe(false);
  });

  test('bloquant : session historique non commercialisable', () => {
    const result = validateProfilCandidat(requireExamPolicy(2026), {
      profil: baseProfil({ examSession: 2026 }),
    });
    const issue = result.erreurs.find((i) => i.code === 'SESSION_NON_COMMERCIALISABLE');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
    expect(issue?.messageFamille).not.toMatch(/undefined/);
  });

  test('source : le message interne cite le statut de session', () => {
    const result = validateProfilCandidat(requireExamPolicy(2026), {
      profil: baseProfil({ examSession: 2026 }),
    });
    const issue = result.erreurs.find((i) => i.code === 'SESSION_NON_COMMERCIALISABLE');
    expect(issue?.messageInterne).toMatch(/HISTORICAL_READONLY/);
  });
});

describe('validateProfilCandidat — P3 (bac accéléré)', () => {
  test('nominal : éligibilité confirmée, aucun avertissement bloquant', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil(),
      bacAccelereEligibilityAnswers: { age20: true },
    });
    expect(result.avertissements.find((i) => i.code === 'P3_ELIGIBILITE_INDETERMINEE')).toBeUndefined();
    expect(result.emissionAutomatiqueAutorisee).toBe(true);
  });

  test('bloquant : condition non auto-vérifiable déclarée — dérogation non vérifiable', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil(),
      bacAccelereEligibilityAnswers: { force_majeure: true },
    });
    const issue = result.avertissements.find((i) => i.code === 'P3_ELIGIBILITE_INDETERMINEE');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
    expect(result.emissionAutomatiqueAutorisee).toBe(false);
    expect(result.necessiteVerificationHumaine).toBe(true);
  });
});

describe('validateProfilCandidat — P11 et P12', () => {
  test('avertissement (non bloquant) : moyenne de rattrapage hors plage 8-10 — P11 ne se déclenche pas', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ moyenneRattrapage: 5 }) });
    const issue = result.informations.find((i) => i.code === 'P11_MOYENNE_HORS_PLAGE');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(false);
  });

  test('bloquant : P12 toujours soumis à validation humaine', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({ etalementPlurisessionsDeclare: true }),
    });
    const issue = result.avertissements.find((i) => i.code === 'P12_VALIDATION_HUMAINE_OBLIGATOIRE');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
    expect(result.emissionAutomatiqueAutorisee).toBe(false);
  });
});

describe('validateProfilCandidat — modalité', () => {
  test('nominal : modalité A, aucun avertissement de coefficient', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ modalite: 'A' }) });
    expect(result.avertissements.find((i) => i.code === 'MODALITE_B_COEFFICIENT_A_VERIFIER')).toBeUndefined();
  });

  test('bloquant : modalité B, HG/LVA/LVB/EMC non sourcés', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ modalite: 'B' }) });
    const issues = result.avertissements.filter((i) => i.code === 'MODALITE_B_COEFFICIENT_A_VERIFIER');
    expect(issues.length).toBeGreaterThanOrEqual(4);
    expect(issues.every((i) => i.blockingForAutomaticQuote)).toBe(true);
    expect(result.emissionAutomatiqueAutorisee).toBe(false);
  });

  test('source : l\'avertissement modalité B référence la matière concernée', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ modalite: 'B' }) });
    const issue = result.avertissements.find((i) => i.code === 'MODALITE_B_COEFFICIENT_A_VERIFIER');
    expect(issue?.field).toBeDefined();
  });
});

describe('validateProfilCandidat — spécialités', () => {
  test('nominal : deux spécialités distinctes et reconnues', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil() });
    expect(result.erreurs.filter((i) => i.field === 'specialite1' || i.field === 'specialite2')).toHaveLength(0);
  });

  test('bloquant : doublon de spécialités', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({ specialite1: 'MATHEMATIQUES', specialite2: 'MATHEMATIQUES' }),
    });
    const issue = result.erreurs.find((i) => i.code === 'SPECIALITES_DOUBLON');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });

  test('bloquant : spécialité abandonnée identique à une spécialité conservée', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({ specialiteAbandonnee: 'MATHEMATIQUES' }),
    });
    const issue = result.erreurs.find((i) => i.code === 'SPECIALITE_ABANDONNEE_INCOHERENTE');
    expect(issue).toBeDefined();
  });
});

describe('validateProfilCandidat — options (délègue à lib/exams/options.ts)', () => {
  test('nominal : DGEMC seul, valide', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ optionsTerminale: ['DGEMC'] }) });
    expect(result.erreurs.filter((i) => i.code.startsWith('OPTION_'))).toHaveLength(0);
  });

  test('bloquant : Maths expertes + Maths complémentaires (incompatibilité déjà codée Lot 1)', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({ optionsTerminale: ['MATHS_EXPERTES', 'MATHS_COMPLEMENTAIRES'] }),
    });
    const issue = result.erreurs.find((i) => i.code === 'OPTION_INVALIDE' && i.messageInterne?.includes('OPTIONS_EXCLUSIVES'));
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });

  test('avertissement bloquant : coefficient d\'option non sourcé, jamais dans le total obligatoire', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ optionsTerminale: ['DGEMC'] }) });
    const issue = result.avertissements.find((i) => i.code === 'OPTION_COEFFICIENT_NON_SOURCE');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });

  test('alias DGMEC accepté en entrée, normalisé en DGEMC dans les messages', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ optionsTerminale: ['DGMEC'] }) });
    const issue = result.avertissements.find((i) => i.code === 'OPTION_COEFFICIENT_NON_SOURCE');
    expect(issue?.field).toBe('DGEMC');
  });
});

describe('validateProfilCandidat — notes antérieures', () => {
  test('nominal : note valide, seuil atteint, session cohérente', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    expect(result.erreurs.filter((i) => i.field === 'notesConservees')).toHaveLength(0);
  });

  test('bloquant : note hors barème (0-20)', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 27, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    const issue = result.erreurs.find((i) => i.code === 'NOTE_HORS_BAREME');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });

  test('bloquant : épreuve non reconnue', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'epreuve-inconnue', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    expect(result.erreurs.find((i) => i.code === 'NOTE_EPREUVE_INCONNUE')).toBeDefined();
  });

  test('bloquant : session d\'origine postérieure ou égale à la session de représentation', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2027, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    expect(result.erreurs.find((i) => i.code === 'NOTE_SESSION_ORIGINE_INVALIDE')).toBeDefined();
  });

  test('bloquant : délai maximal de conservation dépassé (5 sessions)', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2020, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    const issue = result.erreurs.find((i) => i.code === 'NOTE_DELAI_MAXIMAL_DEPASSE');
    expect(issue).toBeDefined();
    expect(issue?.source?.article).toMatch(/D\. 334-13/);
  });

  test('information (non bloquant) : note sous le seuil de conservation', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 8, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    const issue = result.informations.find((i) => i.code === 'NOTE_SEUIL_NON_ATTEINT');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(false);
  });

  test('bloquant : double statut pour la même épreuve', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [
          { epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' },
          { epreuveId: 'philosophie', note: 12, sessionObtention: 2025, mecanisme: 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE' },
        ],
      }),
    });
    expect(result.erreurs.find((i) => i.code === 'NOTE_DOUBLE_STATUT')).toBeDefined();
  });

  test('avertissement bloquant : mécanisme indéterminé', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'INDETERMINE' }],
      }),
    });
    const issue = result.avertissements.find((i) => i.code === 'NOTE_MECANISME_INDETERMINE');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });

  test('bloquant : reconduction automatique confirmée déclarée sans redoublement', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: false,
        notesConservees: [
          { epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE' },
        ],
      }),
    });
    expect(result.erreurs.find((i) => i.code === 'NOTE_RECONDUCTION_SANS_REDOUBLEMENT')).toBeDefined();
  });

  test('avertissement bloquant : divergence de coefficient inter-session (Grand Oral 2026→2027)', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'grand-oral', note: 15, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    const issue = result.avertissements.find((i) => i.code === 'NOTE_DIVERGENCE_COEFFICIENT');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });

  test('information (non bloquant) : perte de mention rappelée quand une conservation est demandée', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estRedoublant: true,
        notesConservees: [{ epreuveId: 'philosophie', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      }),
    });
    const issue = result.informations.find((i) => i.code === 'NOTE_PERTE_MENTION');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(false);
  });
});

describe('validateProfilCandidat — dispenses déclarées', () => {
  test('nominal : aucune dispense déclarée', () => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil({ estTitulaireBacDejaObtenu: true }) });
    expect(result.erreurs.filter((i) => i.field === 'dispensesDeclarees')).toHaveLength(0);
  });

  test('bloquant : épreuve dispensée non reconnue', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [{ epreuveId: 'epreuve-inconnue', statut: 'DECLAREE' }],
      }),
    });
    expect(result.erreurs.find((i) => i.code === 'DISPENSE_EPREUVE_INCONNUE')).toBeDefined();
  });

  test('avertissement bloquant : dispense seulement déclarée, pas confirmée', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [{ epreuveId: 'philosophie', statut: 'DECLAREE' }],
      }),
    });
    const issue = result.avertissements.find((i) => i.code === 'DISPENSE_DECLAREE_NON_CONFIRMEE');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });

  test('bloquant : dispense confirmée sans justificatif', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [{ epreuveId: 'philosophie', statut: 'CONFIRMEE' }],
      }),
    });
    const issue = result.erreurs.find((i) => i.code === 'DISPENSE_CONFIRMEE_SANS_JUSTIFICATIF');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });

  test('nominal : dispense confirmée avec justificatif ne bloque plus rien', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estTitulaireBacDejaObtenu: true,
        dispensesDeclarees: [{ epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'doc-123' }],
      }),
    });
    expect(result.erreurs.filter((i) => i.field === 'dispensesDeclarees')).toHaveLength(0);
    expect(result.emissionAutomatiqueAutorisee).toBe(true);
  });

  test('avertissement (non bloquant) : dispense déclarée hors contexte P7', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({
        estTitulaireBacDejaObtenu: false,
        dispensesDeclarees: [{ epreuveId: 'philosophie', statut: 'DECLAREE' }],
      }),
    });
    const issue = result.avertissements.find((i) => i.code === 'DISPENSE_HORS_CONTEXTE_P7');
    expect(issue).toBeDefined();
  });
});

describe('validateProfilCandidat — faisabilité, données, faits concurrents', () => {
  test('information (non bloquant) : faits concurrents présents, signalés pour information', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true, moyenneRattrapage: 9 }),
    });
    const issue = result.informations.find((i) => i.code === 'FAITS_CONCURRENTS_PRESENTS');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(false);
    expect(issue?.messageInterne).toMatch(/P7_TITULAIRE_BAC/);
  });

  test('bloquant : informations contradictoires (titulaire du bac déclaré en Première)', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({ estTitulaireBacDejaObtenu: true, level: 'PREMIERE' }),
    });
    const issue = result.erreurs.find((i) => i.code === 'INFORMATIONS_CONTRADICTOIRES');
    expect(issue).toBeDefined();
    expect(issue?.blockingForAutomaticQuote).toBe(true);
  });
});

describe('validateProfilCandidat — matrice P1-P12', () => {
  const cases: Array<[string, Partial<ProfilCandidatInput>]> = [
    ['P1', { modalite: 'A' }],
    ['P2', { modalite: 'B' }],
    ['P4', { level: 'PREMIERE', estRedoublant: true }],
    ['P5', { estRedoublant: true, intentionAmelioration: false }],
    ['P6', { estRedoublant: true, intentionAmelioration: true }],
    ['P7', { estTitulaireBacDejaObtenu: true }],
    ['P8', { brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' }],
    ['P10', { level: 'PREMIERE', intentionCycleComplet: false }],
    ['P11', { moyenneRattrapage: 9 }],
    ['P12', { etalementPlurisessionsDeclare: true }],
  ];

  test.each(cases)('%s : la validation résout un résultat structuré et cohérent avec le parcours', (_label, overrides) => {
    const result = validateProfilCandidat(policy2027, { profil: baseProfil(overrides) });
    expect(typeof result.valide).toBe('boolean');
    expect(Array.isArray(result.erreurs)).toBe(true);
    expect(typeof result.necessiteVerificationHumaine).toBe('boolean');
    expect(typeof result.emissionAutomatiqueAutorisee).toBe('boolean');
  });

  test('P12 : emissionAutomatiqueAutorisee toujours false, quelles que soient les autres données', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({ etalementPlurisessionsDeclare: true, modalite: 'A' }),
    });
    expect(result.emissionAutomatiqueAutorisee).toBe(false);
  });

  test('P9 combiné : ne remplace jamais le parcours principal dans les résultats de validation', () => {
    const result = validateProfilCandidat(policy2027, {
      profil: baseProfil({ modalite: 'A', changementSpecialite: true }),
    });
    expect(result.erreurs.filter((i) => i.code.startsWith('P9_'))).toHaveLength(0);
  });
});
