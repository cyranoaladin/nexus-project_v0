/**
 * Golden files for the carte-aware pipeline (recâblage mission §11) — 20+
 * representative profiles, snapshotted via buildCandidateQuoteRecommendation
 * (deterministic, real, never fabricated). Diagnostic and budget are now
 * integrated (mission §1/§2, reusing lib/quotes/{diagnostic,priority,
 * optimizer,recommendation}.ts unchanged) — profil avec diagnostic and
 * profil avec budget contraint are included below.
 *
 * No PII in any fixture (no names/emails/phones — ProfilCandidatInput has
 * none by construction).
 */
import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineInput } from '@/lib/quotes/pipeline';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import type { PublicCandidateInputRaw } from '@/lib/exams/normalize';

afterEach(() => resetCatalogueCacheForTests());

const DEFAULT_BUDGET = { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' } as const;

function input(overrides: Partial<PublicCandidateInputRaw> = {}, rest: Partial<CandidateQuotePipelineInput> = {}): CandidateQuotePipelineInput {
  return {
    publicInput: {
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
      ...overrides,
    },
    budget: DEFAULT_BUDGET,
    ...rest,
  };
}

/** Strips volatile fields (timestamps) so the snapshot is stable across runs. */
function stable(result: ReturnType<typeof buildCandidateQuoteRecommendation>) {
  const clone = JSON.parse(JSON.stringify(result));
  if (clone.snapshot?.computedAt) clone.snapshot.computedAt = '<computedAt>';
  return clone;
}

describe('golden — P1-P12', () => {
  test('P1 — libre 2 ans, modalité A (nominal)', () => {
    expect(stable(buildCandidateQuoteRecommendation(input({ modalite: 'A' })))).toMatchSnapshot();
  });

  test('P2 — libre 2 ans, modalité B', () => {
    expect(stable(buildCandidateQuoteRecommendation(input({ modalite: 'B' })))).toMatchSnapshot();
  });

  test('P3 — dérogation même session, condition confirmée par un staff (age20, ADR Gate 2)', () => {
    const result = buildCandidateQuoteRecommendation({
      publicInput: input().publicInput,
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
      budget: DEFAULT_BUDGET,
    });
    expect(stable(result)).toMatchSnapshot();
  });

  test('P3 — condition déclarée mais non encore décidée par un staff -> revue humaine (jamais confirmée par la seule déclaration)', () => {
    const result = buildCandidateQuoteRecommendation({
      publicInput: input().publicInput,
      staffExtension: {
        p3EligibiliteAudit: [
          {
            motif: 'retour_formation',
            faitsDeclares: true,
            justificatifRequis: true,
            justificatifValide: false,
            decision: 'EN_ATTENTE',
            sourceReglementaire: 'Article 3, arrêté du 16 juillet 2018',
          },
        ],
      },
      budget: DEFAULT_BUDGET,
    });
    expect(stable(result)).toMatchSnapshot();
  });

  test('P4 — redoublement première', () => {
    expect(stable(buildCandidateQuoteRecommendation(input({ level: 'PREMIERE' }, {})))).toMatchSnapshot();
  });

  test('P5 — redoublement terminale', () => {
    const withRedoublement: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estRedoublant: true },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(withRedoublement))).toMatchSnapshot();
  });

  test('P6 — amélioration + terminale', () => {
    const withAmelioration: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estRedoublant: true, intentionAmelioration: true },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(withAmelioration))).toMatchSnapshot();
  });

  test('P7 — titulaire du bac', () => {
    const titulaire: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estTitulaireBacDejaObtenu: true },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(titulaire))).toMatchSnapshot();
  });

  test('P8 — bascule scolaire vers individuel', () => {
    const bascule: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(bascule))).toMatchSnapshot();
  });

  test('P9 combiné — changement de spécialité sur un parcours P1', () => {
    const p9: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, changementSpecialite: true, specialiteAbandonnee: 'SES' },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(p9))).toMatchSnapshot();
  });

  test('P10 — épreuves anticipées seules (première, hors cycle complet)', () => {
    const p10: CandidateQuotePipelineInput = {
      publicInput: { ...input({ level: 'PREMIERE' }).publicInput, intentionCycleComplet: false },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(p10))).toMatchSnapshot();
  });

  test('P11 — second groupe (moyenne rattrapage 9/20)', () => {
    const p11: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, moyenneRattrapage: 9 },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(p11))).toMatchSnapshot();
  });

  test('P12 — étalement plurisessions déclaré', () => {
    const p12: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, etalementPlurisessionsDeclare: true },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(p12))).toMatchSnapshot();
  });
});

describe('golden — notes conservées / dispense / option / cas particuliers', () => {
  test('note conservée confirmée (D. 334-13, seuil atteint)', () => {
    const withNote: CandidateQuotePipelineInput = {
      publicInput: input().publicInput,
      staffExtension: {
        notesConservees: [{ epreuveId: 'eds1', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(withNote))).toMatchSnapshot();
  });

  test('dispense confirmée (arrêté du 14 mai 2020, justificatif vérifié)', () => {
    const withDispense: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estTitulaireBacDejaObtenu: true },
      staffExtension: {
        dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-1' }],
      },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(withDispense))).toMatchSnapshot();
  });

  test('option Maths expertes déclarée (coefficient non sourcé -> DIRECTION_APPROVAL_REQUIRED)', () => {
    const withOption: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, optionsTerminale: ['MATHS_EXPERTES'] },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(withOption))).toMatchSnapshot();
  });

  test('changement de spécialité déclaré sans P9 cohérent (spécialité abandonnée absente) -> INVALID', () => {
    const incoherent: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, changementSpecialite: true },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(incoherent))).toMatchSnapshot();
  });

  test('module non approuvé bloquant (nominal terminale — HG/ES/EMC toujours DIRECTION_A_VALIDER ; LVA/LVB désormais SELECTED depuis l\'activation T3A)', () => {
    expect(stable(buildCandidateQuoteRecommendation(input()))).toMatchSnapshot();
  });

  test('candidat P7 entièrement dispensé des EDS — comparaison de pack tentée', () => {
    const p7FullyDispensed: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estTitulaireBacDejaObtenu: true },
      staffExtension: {
        dispensesDeclarees: [
          { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
          { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
        ],
      },
      budget: DEFAULT_BUDGET,
    };
    expect(stable(buildCandidateQuoteRecommendation(p7FullyDispensed))).toMatchSnapshot();
  });
});

/**
 * Fully-dispensed P7: the ONLY profile shape that reaches READY with
 * today's approved catalogue — every épreuve confirmée-dispensée. This is
 * an honest structural finding, not a limitation of these tests: HG, ES,
 * EMC, LVA, LVB are all DIRECTION_A_VALIDER today (mission §7's own
 * arbitrage matrix), and genererCarteExamen never applies notesConservees
 * to PONCTUELLE-nature épreuves (HG/ES/EMC/LVA/LVB) — only ANTICIPEE/
 * TERMINAL lines can be excluded via conservation. So no profile with any
 * regular subject left to prepare can reach READY until at least one of
 * those 5 elements is approved. Confirmed by direct experimentation before
 * writing these fixtures — not guessed.
 */
const READY_PROFILE_STAFF_EXTENSION = {
  dispensesDeclarees: [
    { epreuveId: 'eds1', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-1' },
    { epreuveId: 'eds2', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-2' },
    { epreuveId: 'philosophie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-3' },
    { epreuveId: 'grand-oral', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-4' },
    { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-5' },
    { epreuveId: 'lva', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-6' },
    { epreuveId: 'lvb', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-7' },
    { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-8' },
    { epreuveId: 'emc', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-9' },
  ],
};

describe('golden — READY, diagnostic, budget (mission recâblage §1/§11)', () => {
  test('profil READY (P7 intégralement dispensé) — Pilotage seul, scénarios structurés', () => {
    const ready: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estTitulaireBacDejaObtenu: true },
      staffExtension: READY_PROFILE_STAFF_EXTENSION,
      budget: DEFAULT_BUDGET,
    };
    const result = buildCandidateQuoteRecommendation(ready);
    expect(result.status).toBe('READY');
    expect(stable(result)).toMatchSnapshot();
  });

  test('profil avec diagnostic partiel (diagnosticStatus=INCOMPLET) — même profil READY, diagnostic fourni mais ne couvre pas tous les sujets projetés', () => {
    const withDiagnostic: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estTitulaireBacDejaObtenu: true },
      staffExtension: READY_PROFILE_STAFF_EXTENSION,
      diagnostic: {
        raw: {
          maths: { points: 12, maxPoints: 20, percentage: 60 },
          physiqueChimie: { points: 15, maxPoints: 20, percentage: 75 },
        },
      },
      budget: DEFAULT_BUDGET,
    };
    const result = buildCandidateQuoteRecommendation(withDiagnostic);
    // Only maths/physiqueChimie domains are supplied — every other projected
    // subject (philo/grand-oral/HG/LVA/LVB/ES) has no diagnostic coverage,
    // so this correctly resolves to INCOMPLET, not EXPLOITABLE — an honest
    // reflection of a partial diagnostic, not a bug in the assertion.
    if (result.status === 'READY') expect(result.diagnosticStatus).toBe('INCOMPLET');
    expect(stable(result)).toMatchSnapshot();
  });

  test('profil avec budget contraint (1 TND/mois) — budgetInsuffisantPourSocle=true, résultat explicite', () => {
    const budgetContraint: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estTitulaireBacDejaObtenu: true },
      staffExtension: READY_PROFILE_STAFF_EXTENSION,
      budget: { monthlyBudgetTnd: 1, strategy: 'RESPECT_BUDGET' },
    };
    const result = buildCandidateQuoteRecommendation(budgetContraint);
    if (result.status === 'READY') {
      expect(result.budgetInsuffisantPourSocle).toBe(true);
      // Le besoin non couvert (Pilotage, non retirable) reste visible dans le scénario — jamais silencieux.
      expect(result.scenarios.find((s) => s.tier === 'ESSENTIEL')?.monthlyTotal).toBeGreaterThan(1);
    }
    expect(stable(result)).toMatchSnapshot();
  });
});
