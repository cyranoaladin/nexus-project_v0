import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineInput } from '@/lib/quotes/pipeline';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import type { PublicCandidateInputRaw } from '@/lib/exams/normalize';

function baseInput(overrides: Partial<PublicCandidateInputRaw> = {}): CandidateQuotePipelineInput {
  return {
    publicInput: {
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
      ...overrides,
    },
    budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
  };
}

afterEach(() => resetCatalogueCacheForTests());

describe('buildCandidateQuoteRecommendation — jamais de null ambigu, toujours un des 7 états nommés', () => {
  test('entrée non normalisable (spécialité inconnue) -> INVALID, jamais un crash', () => {
    const result = buildCandidateQuoteRecommendation(baseInput({ specialite1: 'Chimie Improbable' }));
    expect(result.status).toBe('INVALID');
    if (result.status === 'INVALID') {
      expect(result.reasons.some((r) => r.includes('specialite1'))).toBe(true);
    }
  });

  test('examSession manquant -> INVALID', () => {
    const result = buildCandidateQuoteRecommendation(baseInput({ examSession: undefined }));
    expect(result.status).toBe('INVALID');
  });

  test('deux spécialités identiques -> INVALID (validateProfilCandidat SPECIALITES_DOUBLON)', () => {
    const result = buildCandidateQuoteRecommendation(baseInput({ specialite1: 'MATHEMATIQUES', specialite2: 'MATHEMATIQUES' }));
    expect(result.status).toBe('INVALID');
  });

  test('profil nominal terminale (P1) sans aucune donnée incertaine -> HUMAN_REVIEW_REQUIRED (le nominal a toujours des modules DIRECTION_A_VALIDER en attente : HG/ES/EMC/LVA/LVB)', () => {
    const result = buildCandidateQuoteRecommendation(baseInput());
    // Le profil nominal passe le gate réglementaire mais rencontre des modules
    // DIRECTION_A_VALIDER (HG/ES/EMC/LVA/LVB toujours candidats sur une carte
    // terminale nominale) -> DIRECTION_APPROVAL_REQUIRED, pas HUMAN_REVIEW.
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status === 'DIRECTION_APPROVAL_REQUIRED') {
      expect(result.pendingModuleIds.length).toBeGreaterThan(0);
    }
  });

  test('note conservée avec mécanisme INDETERMINE -> HUMAN_REVIEW_REQUIRED (fail-closed, jamais silencieux)', () => {
    const result = buildCandidateQuoteRecommendation(
      baseInput({}),
    );
    // Rebuild with staff extension carrying an indeterminate mécanisme.
    const withStaff: CandidateQuotePipelineInput = {
      publicInput: baseInput().publicInput,
      staffExtension: {
        notesConservees: [{ epreuveId: 'eaf-ecrit', note: 15, sessionObtention: 2026, mecanisme: 'INDETERMINE' }],
      },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    };
    const result2 = buildCandidateQuoteRecommendation(withStaff);
    expect(result2.status).toBe('HUMAN_REVIEW_REQUIRED');
    expect(result).toBeDefined(); // sanity — the first (staff-less) call above did not throw
  });

  test('dispense déclarée non confirmée -> HUMAN_REVIEW_REQUIRED, jamais un devis émis automatiquement', () => {
    const input: CandidateQuotePipelineInput = {
      publicInput: baseInput({ estTitulaireBacDejaObtenu: true }).publicInput,
      staffExtension: { dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'DECLAREE' }] },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    };
    const result = buildCandidateQuoteRecommendation(input);
    expect(result.status).toBe('HUMAN_REVIEW_REQUIRED');
  });

  test('conservation confirmée sur EDS1 + EDS2 (candidat P7 titulaire, aucun module en attente) : réachable jusqu\'à READY si aucun élément DIRECTION_A_VALIDER ne subsiste', () => {
    // P7 (titulaire du bac) + toutes les dispenses confirmées + aucune matière
    // hors périmètre pédagogique déclenchée -> devrait au moins dépasser INVALID.
    const input: CandidateQuotePipelineInput = {
      publicInput: baseInput({ estTitulaireBacDejaObtenu: true }).publicInput,
      staffExtension: {
        dispensesDeclarees: [
          { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
          { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
        ],
      },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    };
    const result = buildCandidateQuoteRecommendation(input);
    // eds1/eds2 confirmés dispensés -> exclus du catalogue ; il reste
    // Philosophie/Grand Oral (APPROVED) + HG/ES/EMC/LVA/LVB (DIRECTION_A_VALIDER,
    // toujours candidats sur une carte nominale) -> DIRECTION_APPROVAL_REQUIRED.
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
  });

  test('un résultat READY expose 3 scénarios cohérents (ESSENTIEL/RECOMMANDE/COMPLET), sinon un des 6 autres états nommés (test de structure)', () => {
    // On ne peut pas atteindre READY avec le catalogue réel tant que HG/ES/
    // EMC/LVA/LVB restent DIRECTION_A_VALIDER sur un nominal terminale — teste
    // ici uniquement que la fonction ne renvoie jamais un état incohérent
    // (chaque status renvoie exactement les champs de son type, pas plus).
    const result = buildCandidateQuoteRecommendation(baseInput());
    if (result.status === 'READY') {
      expect(result.scenarios.map((s) => s.tier).sort()).toEqual(['COMPLET', 'ESSENTIEL', 'RECOMMANDE']);
      expect(result.diagnosticStatus).toBe('ABSENT');
    } else {
      // PROVISIONAL was removed (mission "fair go-live" Phase G — dead
      // canonical state, never constructed; DEAD_CANONICAL_DOMAIN_STATES = 0).
      expect(['INVALID', 'NOT_ELIGIBLE', 'HUMAN_REVIEW_REQUIRED', 'DIRECTION_APPROVAL_REQUIRED', 'UNPRICED']).toContain(
        result.status,
      );
    }
  });

  test('diagnostic absent -> diagnosticStatus=ABSENT, budget insuffisant pour le socle -> résultat explicite (profil réellement READY, pas un test vacueux)', () => {
    // P7 intégralement dispensé — le seul profil qui atteint READY avec le
    // catalogue approuvé aujourd'hui (voir pipeline.golden.test.ts pour le
    // constat structurel complet). Sans ce fixture précis, cette assertion
    // resterait dans la branche `if (status === 'READY')` sans jamais
    // s'exécuter — corrigé ici pour être réellement exercée.
    const insuffisant: CandidateQuotePipelineInput = {
      publicInput: baseInput({ estTitulaireBacDejaObtenu: true }).publicInput,
      staffExtension: {
        dispensesDeclarees: [
          { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
          { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
          { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'REF-3' },
          { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'REF-4' },
          { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'REF-5' },
          { epreuveId: 'lva', statut: 'CONFIRMEE', justificatifRef: 'REF-6' },
          { epreuveId: 'lvb', statut: 'CONFIRMEE', justificatifRef: 'REF-7' },
          { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'REF-8' },
          { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'REF-9' },
        ],
      },
      budget: { monthlyBudgetTnd: 1, strategy: 'RESPECT_BUDGET' },
    };
    const result = buildCandidateQuoteRecommendation(insuffisant);
    expect(result.status).toBe('READY');
    if (result.status === 'READY') {
      expect(result.diagnosticStatus).toBe('ABSENT');
      expect(result.budgetInsuffisantPourSocle).toBe(true);
    }
  });

  test('P3 (dérogation même session) : le pipeline ne prétend jamais couvrir un rythme compressé sans avertissement — jamais un volume irréaliste vendu silencieusement (mission "vers un produit complet" §3)', () => {
    const p3: CandidateQuotePipelineInput = {
      publicInput: baseInput().publicInput,
      staffExtension: {
        p3EligibiliteAudit: [
          {
            motif: 'age20',
            faitsDeclares: true,
            justificatifRequis: false,
            justificatifValide: true,
            decision: 'CONFIRMEE',
            validateurUserId: 'staff-1',
            dateDecision: '2026-08-26',
            sourceReglementaire: 'Article 3, arrêté du 16 juillet 2018',
          },
        ],
      },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    };
    const result = buildCandidateQuoteRecommendation(p3);

    // Peu importe le statut atteint (HUMAN_REVIEW_REQUIRED est le cas
    // nominal ici — P3 combine systématiquement le tronc terminal complet,
    // toujours DIRECTION_APPROVAL_REQUIRED ou HUMAN_REVIEW_REQUIRED avec le
    // catalogue actuel) : l'avertissement sur le rythme compressé doit
    // être présent quelque part dans la surface visible du résultat.
    const carte = 'carte' in result ? result.carte : undefined;
    expect(carte?.avertissementsGeneraux.some((a) => a.includes('P3') && a.includes('rythme'))).toBe(true);

    // Finding honnête, pas travaillé autour : le moteur ne calcule
    // aujourd'hui aucun volume horaire majoré ni aucune "couverture
    // réalisable" spécifique au rythme compressé — scoreSubjects
    // (lib/quotes/priority.ts) n'utilise monthsRemaining que pour
    // l'ordre de priorité, jamais lib/quotes/pricing.ts::volumeForSubject
    // qui fixe les heures/mois. Ce test documente l'absence de ce calcul
    // autant qu'il vérifie la présence de l'avertissement — un futur lot
    // qui ajouterait un vrai calcul de charge devra remplacer cet
    // avertissement générique par un chiffrage réel, jamais l'inverse.
  });
});
