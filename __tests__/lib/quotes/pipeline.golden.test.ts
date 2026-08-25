/**
 * Golden files for the carte-aware pipeline (recâblage mission §11) — 18
 * representative profiles, snapshotted via buildCandidateQuoteRecommendation
 * (deterministic, real, never fabricated). Two scenarios from the mission's
 * list (diagnostic absent, budget insuffisant) are explicitly out of scope:
 * this pipeline version has no diagnostic/budget/optimizer integration yet
 * (Phase A note, lot5-phase-a-moteur-tarifaire.md) — producing a "golden"
 * result for a concept the pipeline doesn't model would be invented, not
 * captured, so they are omitted rather than faked.
 *
 * No PII in any fixture (no names/emails/phones — ProfilCandidatInput has
 * none by construction).
 */
import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineInput } from '@/lib/quotes/pipeline';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import type { PublicCandidateInputRaw } from '@/lib/exams/normalize';

afterEach(() => resetCatalogueCacheForTests());

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

  test('P3 — dérogation même session, condition auto-vérifiable confirmée (age20)', () => {
    const result = buildCandidateQuoteRecommendation(
      input({}, { bacAccelereEligibilityAnswers: { age20: true } }),
    );
    expect(stable(result)).toMatchSnapshot();
  });

  test('P3 — dérogation, condition non auto-vérifiable -> revue humaine', () => {
    const result = buildCandidateQuoteRecommendation(
      input({}, { bacAccelereEligibilityAnswers: { retour_formation: true } }),
    );
    expect(stable(result)).toMatchSnapshot();
  });

  test('P4 — redoublement première', () => {
    expect(stable(buildCandidateQuoteRecommendation(input({ level: 'PREMIERE' }, {})))).toMatchSnapshot();
  });

  test('P5 — redoublement terminale', () => {
    const withRedoublement: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estRedoublant: true },
    };
    expect(stable(buildCandidateQuoteRecommendation(withRedoublement))).toMatchSnapshot();
  });

  test('P6 — amélioration + terminale', () => {
    const withAmelioration: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estRedoublant: true, intentionAmelioration: true },
    };
    expect(stable(buildCandidateQuoteRecommendation(withAmelioration))).toMatchSnapshot();
  });

  test('P7 — titulaire du bac', () => {
    const titulaire: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estTitulaireBacDejaObtenu: true },
    };
    expect(stable(buildCandidateQuoteRecommendation(titulaire))).toMatchSnapshot();
  });

  test('P8 — bascule scolaire vers individuel', () => {
    const bascule: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' },
    };
    expect(stable(buildCandidateQuoteRecommendation(bascule))).toMatchSnapshot();
  });

  test('P9 combiné — changement de spécialité sur un parcours P1', () => {
    const p9: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, changementSpecialite: true, specialiteAbandonnee: 'SES' },
    };
    expect(stable(buildCandidateQuoteRecommendation(p9))).toMatchSnapshot();
  });

  test('P10 — épreuves anticipées seules (première, hors cycle complet)', () => {
    const p10: CandidateQuotePipelineInput = {
      publicInput: { ...input({ level: 'PREMIERE' }).publicInput, intentionCycleComplet: false },
    };
    expect(stable(buildCandidateQuoteRecommendation(p10))).toMatchSnapshot();
  });

  test('P11 — second groupe (moyenne rattrapage 9/20)', () => {
    const p11: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, moyenneRattrapage: 9 },
    };
    expect(stable(buildCandidateQuoteRecommendation(p11))).toMatchSnapshot();
  });

  test('P12 — étalement plurisessions déclaré', () => {
    const p12: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, etalementPlurisessionsDeclare: true },
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
    };
    expect(stable(buildCandidateQuoteRecommendation(withNote))).toMatchSnapshot();
  });

  test('dispense confirmée (arrêté du 14 mai 2020, justificatif vérifié)', () => {
    const withDispense: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, estTitulaireBacDejaObtenu: true },
      staffExtension: {
        dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-1' }],
      },
    };
    expect(stable(buildCandidateQuoteRecommendation(withDispense))).toMatchSnapshot();
  });

  test('option Maths expertes déclarée (coefficient non sourcé -> DIRECTION_APPROVAL_REQUIRED)', () => {
    const withOption: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, optionsTerminale: ['MATHS_EXPERTES'] },
    };
    expect(stable(buildCandidateQuoteRecommendation(withOption))).toMatchSnapshot();
  });

  test('changement de spécialité déclaré sans P9 cohérent (spécialité abandonnée absente) -> INVALID', () => {
    const incoherent: CandidateQuotePipelineInput = {
      publicInput: { ...input().publicInput, changementSpecialite: true },
    };
    expect(stable(buildCandidateQuoteRecommendation(incoherent))).toMatchSnapshot();
  });

  test('module non approuvé bloquant (nominal terminale — HG/ES/EMC/LVA/LVB toujours DIRECTION_A_VALIDER)', () => {
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
    };
    expect(stable(buildCandidateQuoteRecommendation(p7FullyDispensed))).toMatchSnapshot();
  });
});
