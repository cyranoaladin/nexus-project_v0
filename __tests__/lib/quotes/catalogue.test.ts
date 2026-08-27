import { requireExamPolicy } from '@/lib/exams/catalog';
import { genererCarteExamen } from '@/lib/exams/carte';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import {
  adaptCatalogueSelectionToExamProfile,
  coverageItemsForSelection,
  detectDoubleBilling,
  getCatalogue,
  resolveCatalogueModules,
  resetCatalogueCacheForTests,
  type SelectedCoverageItem,
} from '@/lib/quotes/catalogue';

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
    dispensesDeclarees: null,
    etalementPlurisessionsDeclare: false,
    moyenneRattrapage: null,
    optionsTerminale: [],
    notesConservees: null,
    ...overrides,
  };
}

function resolve(profil: ProfilCandidatInput) {
  const carte = genererCarteExamen({ profil, policy: policy2027 });
  return { carte, selection: resolveCatalogueModules(carte, profil) };
}

function moduleStatus(modules: ReturnType<typeof resolveCatalogueModules>['modules'], moduleId: string) {
  return modules.find((m) => m.moduleId === moduleId)?.status;
}

afterEach(() => resetCatalogueCacheForTests());

describe('resolveCatalogueModules — couverture nominale (mission §13 "chaque épreuve à présenter possède au moins une stratégie")', () => {
  test('candidat terminale nominal (P1/P2) : EDS1/EDS2/Philosophie/Grand Oral sélectionnés', () => {
    const { selection } = resolve(baseProfil());
    expect(moduleStatus(selection.modules, 'MOD_EDS1')).toBe('SELECTED');
    expect(moduleStatus(selection.modules, 'MOD_EDS2')).toBe('SELECTED');
    expect(moduleStatus(selection.modules, 'MOD_PHILOSOPHIE')).toBe('SELECTED');
    expect(moduleStatus(selection.modules, 'MOD_GRAND_ORAL')).toBe('SELECTED');
  });

  test('EAF/EAM RECONDUITE (primo-candidat continu, sûr) : module exclu, jamais facturé (mission §10 exemple)', () => {
    const { carte, selection } = resolve(baseProfil());
    expect(carte.epreuves.find((e) => e.code === 'eaf-ecrit')?.statut).toBe('RECONDUITE');
    expect(carte.epreuves.find((e) => e.code === 'eaf-ecrit')?.necessiteVerificationHumaine).toBe(false);
    expect(moduleStatus(selection.modules, 'MOD_EAF_ECRIT_ORAL')).toBe('EXCLUDED');
  });

  test('spécialité abandonnée absente du profil : module exclu (aucune épreuve correspondante)', () => {
    const { selection } = resolve(baseProfil({ specialiteAbandonnee: null }));
    expect(moduleStatus(selection.modules, 'MOD_SPECIALITE_ABANDONNEE')).toBe('EXCLUDED');
  });

  test('spécialité abandonnée déclarée : épreuve présente, module SELECTED (T3A activation — direction-decisions-commercial-governance.md §3bis, APPROVED 4h/mois depuis 11→8)', () => {
    const { selection } = resolve(baseProfil({ specialiteAbandonnee: 'SES' }));
    expect(moduleStatus(selection.modules, 'MOD_SPECIALITE_ABANDONNEE')).toBe('SELECTED');
  });
});

describe('conservation/dispense confirmées excluent le module (mission §10)', () => {
  test('note conservée confirmée (D. 334-13, seuil atteint) : EDS1 devient CONSERVEE, module exclu, prix non réduit automatiquement ailleurs', () => {
    const profil = baseProfil({
      notesConservees: [
        { epreuveId: 'eds1', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' },
      ],
    });
    const { carte, selection } = resolve(profil);
    const eds1 = carte.epreuves.find((e) => e.code === 'eds1')!;
    expect(eds1.statut).toBe('CONSERVEE');
    expect(eds1.necessiteVerificationHumaine).toBe(false);
    expect(moduleStatus(selection.modules, 'MOD_EDS1')).toBe('EXCLUDED');
  });

  test('dispense DÉCLARÉE (non confirmée) ne réduit jamais automatiquement — module reste NEEDS_HUMAN_REVIEW, jamais EXCLUDED ni SELECTED', () => {
    const profil = baseProfil({
      estTitulaireBacDejaObtenu: true,
      dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'DECLAREE' }],
    });
    const { carte, selection } = resolve(profil);
    const eds2 = carte.epreuves.find((e) => e.code === 'eds2')!;
    expect(eds2.statut).toBe('DISPENSEE');
    expect(eds2.necessiteVerificationHumaine).toBe(true);
    expect(moduleStatus(selection.modules, 'MOD_EDS2')).toBe('NEEDS_HUMAN_REVIEW');
  });

  test('dispense CONFIRMÉE (justificatif vérifié) : module exclu, définitif', () => {
    const profil = baseProfil({
      estTitulaireBacDejaObtenu: true,
      dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-123' }],
    });
    const { carte, selection } = resolve(profil);
    const eds2 = carte.epreuves.find((e) => e.code === 'eds2')!;
    expect(eds2.statut).toBe('DISPENSEE');
    expect(eds2.necessiteVerificationHumaine).toBe(false);
    expect(moduleStatus(selection.modules, 'MOD_EDS2')).toBe('EXCLUDED');
  });

  test('mécanisme de reconduction INDETERMINE bloque : ni EXCLUDED ni SELECTED', () => {
    const profil = baseProfil({
      estRedoublant: true,
      notesConservees: [{ epreuveId: 'eaf-ecrit', note: 15, sessionObtention: 2026, mecanisme: 'INDETERMINE' }],
    });
    const { carte, selection } = resolve(profil);
    const eaf = carte.epreuves.find((e) => e.code === 'eaf-ecrit')!;
    expect(eaf.necessiteVerificationHumaine).toBe(true);
    expect(moduleStatus(selection.modules, 'MOD_EAF_ECRIT_ORAL')).toBe('NEEDS_HUMAN_REVIEW');
  });
});

describe('options (mission §10 "NSI/PC/SI/SVT ne doivent pas générer une préparation pratique interdite")', () => {
  test('Maths expertes déclarée : module NEEDS_HUMAN_REVIEW (aucun coefficient/volume sourcé — jamais auto-sélectionné)', () => {
    const { selection } = resolve(baseProfil({ optionsTerminale: ['MATHS_EXPERTES'] }));
    expect(moduleStatus(selection.modules, 'MOD_MATHS_EXPERTES')).toBe('NEEDS_HUMAN_REVIEW');
  });

  test("option non déclarée : module exclu", () => {
    const { selection } = resolve(baseProfil({ optionsTerminale: [] }));
    expect(moduleStatus(selection.modules, 'MOD_MATHS_EXPERTES')).toBe('EXCLUDED');
    expect(moduleStatus(selection.modules, 'MOD_DGEMC')).toBe('EXCLUDED');
  });

  test('DGMEC (variante mal orthographiée) normalisée vers DGEMC — reconnue par le catalogue', () => {
    const { selection } = resolve(baseProfil({ optionsTerminale: ['DGMEC'] }));
    expect(moduleStatus(selection.modules, 'MOD_DGEMC')).toBe('NEEDS_HUMAN_REVIEW');
  });
});

describe('D1 — socle EP (décision approuvée, mission §7)', () => {
  test('HG/Enseignement scientifique/EMC utilisent le format autonomie_guidee_aria, jamais petit_groupe/duo', () => {
    const catalogueModules = ['MOD_HG_ARIA', 'MOD_ES_ARIA', 'MOD_EMC_ARIA'];
    const { selection } = resolve(baseProfil());
    for (const id of catalogueModules) {
      const m = selection.modules.find((mod) => mod.moduleId === id)!;
      expect(m.deliveryMode).toBe('autonomie_guidee_aria');
    }
  });

  test('LVA/LVB utilisent le format petit_groupe (live), jamais autonomie_guidee_aria', () => {
    const { selection } = resolve(baseProfil());
    expect(selection.modules.find((m) => m.moduleId === 'MOD_LVA')!.deliveryMode).toBe('petit_groupe');
    expect(selection.modules.find((m) => m.moduleId === 'MOD_LVB')!.deliveryMode).toBe('petit_groupe');
  });

  test('spécialité abandonnée : format petit_groupe mono-discipline (jamais duo/individuel forcé, pas de mutualisation transdisciplinaire modélisée)', () => {
    const { selection } = resolve(baseProfil({ specialiteAbandonnee: 'SES' }));
    expect(selection.modules.find((m) => m.moduleId === 'MOD_SPECIALITE_ABANDONNEE')!.deliveryMode).toBe('petit_groupe');
  });

  test('EPS : service administratif, jamais un module horaire facturable séparément (pas d\'entraînement sportif)', () => {
    const catalogue = getCatalogue();
    const eps = catalogue.services.find((s) => s.serviceId === 'SVC_EPS_ADMINISTRATIF');
    expect(eps).toBeDefined();
    expect(eps!.pricingRuleId).toBeNull();
    expect(eps!.label.toLowerCase()).not.toMatch(/entraînement|sportif/);
  });
});

describe('P1–P12 — Pilotage et parcours (mission §12)', () => {
  test('P11 (second groupe) : Pilotage exclu de la sélection', () => {
    const { selection } = resolve(baseProfil({ moyenneRattrapage: 9 }));
    expect(selection.parcoursPrincipal).toBe('P11_SECOND_GROUPE');
    expect(selection.pilotageIncluded).toBe(false);
  });

  test('P12 (étalement plurisessions) : Pilotage exclu, revue humaine obligatoire', () => {
    const { selection } = resolve(baseProfil({ etalementPlurisessionsDeclare: true }));
    expect(selection.parcoursPrincipal).toBe('P12_ETALEMENT_PLURISESSIONS');
    expect(selection.pilotageIncluded).toBe(false);
    expect(selection.necessiteVerificationHumaine).toBe(true);
    expect(selection.emissionAutomatiqueAutorisee).toBe(false);
  });

  test('P9 combiné à un parcours principal (changementSpecialite) : Pilotage reste inclus, P9 ne devient jamais un parcours à part', () => {
    const { selection } = resolve(baseProfil({ changementSpecialite: true, specialiteAbandonnee: 'SES' }));
    expect(selection.parcoursPrincipal).not.toBe('P9_CHANGEMENT_SPECIALITE');
    expect(selection.pilotageIncluded).toBe(true);
  });

  test('parcours nominal (P1) : Pilotage inclus', () => {
    const { selection } = resolve(baseProfil());
    expect(selection.pilotageIncluded).toBe(true);
  });
});

describe('anti-double-facturation (mission §6/§14)', () => {
  function scenario(a: SelectedCoverageItem, b: SelectedCoverageItem) {
    return detectDoubleBilling([a, b]);
  }

  test('Pilotage + Cyclades facturé séparément avec la même couverture -> détecté', () => {
    const issues = scenario(
      { id: 'SVC_PILOTAGE', coverageKey: 'APPUI_CYCLADES' },
      { id: 'SVC_CYCLADES_STANDALONE_HYPOTHETIQUE', coverageKey: 'APPUI_CYCLADES' },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].coverageKey).toBe('APPUI_CYCLADES');
  });

  test('Pilotage + diagnostic facturé séparément -> détecté', () => {
    const issues = scenario(
      { id: 'SVC_PILOTAGE', coverageKey: 'DIAGNOSTIC_STRATEGIQUE' },
      { id: 'SVC_DIAGNOSTIC_STANDALONE_HYPOTHETIQUE', coverageKey: 'DIAGNOSTIC_STRATEGIQUE' },
    );
    expect(issues).toHaveLength(1);
  });

  test('Pilotage + carte facturée séparément -> détecté', () => {
    const issues = scenario(
      { id: 'SVC_PILOTAGE', coverageKey: 'CARTE_EXAMEN' },
      { id: 'SVC_CARTE_STANDALONE_HYPOTHETIQUE', coverageKey: 'CARTE_EXAMEN' },
    );
    expect(issues).toHaveLength(1);
  });

  test('pack + modules élémentaires couvrant la même chose -> détecté', () => {
    const issues = scenario(
      { id: 'terminale-libre-focus-bac', coverageKey: 'EDS1' },
      { id: 'MOD_EDS1', coverageKey: 'EDS1' },
    );
    expect(issues).toHaveLength(1);
  });

  test('ARIA incluse (Pilotage) + forfait ARIA séparé -> détecté', () => {
    const issues = scenario(
      { id: 'SVC_PILOTAGE', coverageKey: 'ARIA_ACCESS' },
      { id: 'FORFAIT_ARIA_HYPOTHETIQUE', coverageKey: 'ARIA_ACCESS' },
    );
    expect(issues).toHaveLength(1);
  });

  test('Grand Oral inclus (Focus Bac) + module Grand Oral ajouté séparément -> détecté', () => {
    const issues = scenario(
      { id: 'terminale-libre-focus-bac', coverageKey: 'GRAND_ORAL' },
      { id: 'MOD_GRAND_ORAL', coverageKey: 'GRAND_ORAL' },
    );
    expect(issues).toHaveLength(1);
  });

  test('aucun doublon quand les coverageKeys sont distincts', () => {
    const issues = scenario({ id: 'SVC_PILOTAGE', coverageKey: 'CARTE_EXAMEN' }, { id: 'MOD_EDS1', coverageKey: 'EDS1' });
    expect(issues).toEqual([]);
  });

  test('coverageItemsForSelection() : une sélection nominale réelle ne produit jamais de doublon', () => {
    const { selection } = resolve(baseProfil());
    const items = coverageItemsForSelection(selection);
    expect(detectDoubleBilling(items)).toEqual([]);
  });
});

describe('adaptCatalogueSelectionToExamProfile — adaptateur transitoire (mission §4)', () => {
  test('modules SELECTED avec équivalent legacy sont transmis avec leur coefficient', () => {
    const { selection } = resolve(baseProfil());
    const adapted = adaptCatalogueSelectionToExamProfile(selection);
    const eds1 = adapted.subjects.find((s) => s.subject === 'eds1');
    expect(eds1).toBeDefined();
    expect(eds1!.coefficient).toBeGreaterThan(0);
  });

  test('modules sans équivalent legacy (EMC) sont signalés, jamais silencieusement absents', () => {
    const { selection } = resolve(baseProfil());
    const adapted = adaptCatalogueSelectionToExamProfile(selection);
    expect(adapted.modulesNonRepresentables).toContain('MOD_EMC_ARIA');
    expect(adapted.avertissements.some((w) => w.includes('EMC'))).toBe(true);
  });

  test('un cas incertain (dispense déclarée) ne devient jamais un ExamProfileSubject silencieux', () => {
    const profil = baseProfil({
      estTitulaireBacDejaObtenu: true,
      dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'DECLAREE' }],
    });
    const { selection } = resolve(profil);
    const adapted = adaptCatalogueSelectionToExamProfile(selection);
    expect(adapted.subjects.find((s) => s.subject === 'eds2')).toBeUndefined();
    expect(adapted.avertissements.some((w) => w.includes('eds2') || w.toLowerCase().includes('spécialité'))).toBe(true);
  });

  test('emissionAutomatiqueAutorisee est false dès qu\'un module non représentable existe (nominal terminale a toujours HG/ES/EMC/LVA/LVB en attente)', () => {
    const { selection } = resolve(baseProfil());
    const adapted = adaptCatalogueSelectionToExamProfile(selection);
    expect(adapted.emissionAutomatiqueAutorisee).toBe(false);
  });
});
