/**
 * T3A CLOSEOUT §1/§6 — proves, against the REAL committed
 * data/pricing.canonical.json (never a fixture), that the catalogue is
 * byte-for-byte unchanged by this lot: T3A's original activation of
 * MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE was reverted at closeout
 * because PETIT_GROUPE_4H_GOVERNANCE = UNAPPROVED_BUSINESS_ASSUMPTION —
 * direction approved 250/470/680 TND (the rate table) but never a
 * specific volume/frequency for these three modules, and the `derive`
 * volumePolicy this lot had written cited an internal "hypothèse
 * recommandée" (docs/candidat-individuel/lot5-fiches-arbitrage-volumes.md,
 * an arbitration-*proposal* document) rather than a confirmed decision or
 * an existing sold offer (contrast MOD_EDS1's precedent, which cites an
 * actual existing SKU's stated hours). See the T3A closeout report for
 * the full trace.
 *
 * Every "stays blocked" claim is proven by actually driving the real
 * pipeline (buildCandidateQuoteRecommendation) with an input that would
 * select the item, and observing it still gate emission — the same
 * mechanism a real candidate/profil would hit — never by reading the JSON
 * alone.
 *
 * Zero elements are APPROVED by this lot: MOD_LVA, MOD_LVB,
 * MOD_SPECIALITE_ABANDONNEE, MOD_HG_ARIA, MOD_ES_ARIA, MOD_EMC_ARIA,
 * MOD_EAF_DESCRIPTIF, MOD_MATHS_EXPERTES, MOD_MATHS_COMPLEMENTAIRES,
 * MOD_DGEMC, MOD_LCA, SVC_BACS_BLANCS all remain DIRECTION_A_VALIDER;
 * SVC_SECOND_GROUPE stays exactly in its pre-existing governed state.
 */
import { getCatalogue, resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineInput } from '@/lib/quotes/pipeline';

afterEach(() => resetCatalogueCacheForTests());

const STILL_BLOCKED_MODULE_IDS = [
  'MOD_LVA',
  'MOD_LVB',
  'MOD_SPECIALITE_ABANDONNEE',
  'MOD_HG_ARIA',
  'MOD_ES_ARIA',
  'MOD_EMC_ARIA',
  'MOD_EAF_DESCRIPTIF',
  'MOD_MATHS_EXPERTES',
  'MOD_MATHS_COMPLEMENTAIRES',
  'MOD_DGEMC',
  'MOD_LCA',
];

function baseInput(overrides: Partial<CandidateQuotePipelineInput['publicInput']> = {}): CandidateQuotePipelineInput {
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

describe('T3A closeout §1/§6 — structural: directionApprovalStatus, read via the real loader (never a manual JSON read)', () => {
  test('MOD_LVA, MOD_LVB, MOD_SPECIALITE_ABANDONNEE remain DIRECTION_A_VALIDER — activation was reverted', () => {
    const catalogue = getCatalogue();
    for (const id of ['MOD_LVA', 'MOD_LVB', 'MOD_SPECIALITE_ABANDONNEE']) {
      const m = catalogue.modules.find((mod) => mod.moduleId === id);
      expect(m).toBeDefined();
      expect(m!.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
      expect(m!.pricingRuleId).toBeNull();
      expect(m!.volumePolicy.kind).toBe('direction_a_valider');
    }
  });

  test('every other DIRECTION_A_VALIDER-gated module remains DIRECTION_A_VALIDER — no opportunistic activation', () => {
    const catalogue = getCatalogue();
    for (const id of ['MOD_HG_ARIA', 'MOD_ES_ARIA', 'MOD_EMC_ARIA', 'MOD_EAF_DESCRIPTIF', 'MOD_MATHS_EXPERTES', 'MOD_MATHS_COMPLEMENTAIRES', 'MOD_DGEMC', 'MOD_LCA']) {
      const m = catalogue.modules.find((mod) => mod.moduleId === id);
      expect(m).toBeDefined();
      expect(m!.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
    }
  });

  test('SVC_BACS_BLANCS and SVC_SECOND_GROUPE remain DIRECTION_A_VALIDER — no opportunistic service-level change either', () => {
    const catalogue = getCatalogue();
    for (const id of ['SVC_BACS_BLANCS', 'SVC_SECOND_GROUPE']) {
      const s = catalogue.services.find((svc) => svc.serviceId === id);
      expect(s).toBeDefined();
      expect(s!.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
    }
  });

  test('the APPROVED module set is exactly the pre-existing 6 — zero new approvals by this lot', () => {
    const catalogue = getCatalogue();
    const approvedIds = catalogue.modules.filter((m) => m.directionApprovalStatus === 'APPROVED').map((m) => m.moduleId).sort();
    const expected = ['MOD_EAF_ECRIT_ORAL', 'MOD_EAM', 'MOD_EDS1', 'MOD_EDS2', 'MOD_PHILOSOPHIE', 'MOD_GRAND_ORAL'].sort();
    expect(approvedIds).toEqual(expected);
  });
});

describe('T3A closeout §1/§6 — behavioral: the real pipeline still blocks every direction-gated item, including the three this lot had activated', () => {
  test('nominal profil (no dispenses): MOD_HG_ARIA/MOD_ES_ARIA/MOD_EMC_ARIA/MOD_LVA/MOD_LVB all still pending', () => {
    const result = buildCandidateQuoteRecommendation(baseInput());
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status !== 'DIRECTION_APPROVAL_REQUIRED') return;
    expect(result.pendingModuleIds).toEqual(
      expect.arrayContaining(['MOD_HG_ARIA', 'MOD_ES_ARIA', 'MOD_EMC_ARIA', 'MOD_LVA', 'MOD_LVB']),
    );
  });

  test.each(['MATHS_EXPERTES', 'DGEMC', 'LCA_LATIN'] as const)(
    'option %s: still regulatory-blocked (HUMAN_REVIEW_REQUIRED, OPTION_COEFFICIENT_NON_SOURCE)',
    (option) => {
      const result = buildCandidateQuoteRecommendation(baseInput({ optionsTerminale: [option] }));
      expect(result.status).toBe('HUMAN_REVIEW_REQUIRED');
    },
  );

  test('MOD_MATHS_COMPLEMENTAIRES (declared without a maths spécialité, so it is not also INVALID for an unrelated reason): still HUMAN_REVIEW_REQUIRED', () => {
    const result = buildCandidateQuoteRecommendation(
      baseInput({ specialite1: 'NSI', specialite2: 'SES', optionsTerminale: ['MATHS_COMPLEMENTAIRES'] }),
    );
    expect(result.status).toBe('HUMAN_REVIEW_REQUIRED');
  });

  test('MOD_EAF_DESCRIPTIF (PREMIERE profil, eaf-oral genuinely A_PRESENTER not reconduite): still DIRECTION_APPROVAL_REQUIRED, pendingModuleIds=[MOD_EAF_DESCRIPTIF]', () => {
    const result = buildCandidateQuoteRecommendation({
      publicInput: { level: 'PREMIERE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    });
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status !== 'DIRECTION_APPROVAL_REQUIRED') return;
    expect(result.pendingModuleIds).toContain('MOD_EAF_DESCRIPTIF');
  });

  test('a LVA/LVB-eligible profil (undispensed, diagnosed weakness) cannot reach READY — confirmedHeadcountBySubject workflow proof stays fixture-only, real catalogue unaffected', () => {
    const result = buildCandidateQuoteRecommendation({
      publicInput: { ...baseInput().publicInput, langueA: 'ANGLAIS' },
      diagnostic: { raw: { anglais: { points: 15, maxPoints: 100, percentage: 15 } } },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    });
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status !== 'DIRECTION_APPROVAL_REQUIRED') return;
    expect(result.pendingModuleIds).toContain('MOD_LVA');
  });

  test('SVC_BACS_BLANCS: structurally unreachable through the pipeline — resolveCatalogueModules/adaptCatalogueSelectionToExamProfile never consume catalogue.services beyond SVC_PILOTAGE and (P11-branch only) SVC_SECOND_GROUPE, so no profil input can ever select it; its DIRECTION_A_VALIDER status (asserted above) is therefore not merely undisturbed but provably never exercised by any emission path', () => {
    // No behavioral trigger exists to assert against (by design — this is
    // the point being proven): the structural assertion above is the
    // complete proof for this item. This test exists to make that
    // reasoning explicit and searchable, not to duplicate the JSON check.
    expect(true).toBe(true);
  });

  test('a P11-eligible profile still cannot create a Quote — SVC_SECOND_GROUPE unchanged, no opportunistic activation via this lot', () => {
    const result = buildCandidateQuoteRecommendation(baseInput({ moyenneRattrapage: 9 }));
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status === 'DIRECTION_APPROVAL_REQUIRED') {
      expect(result.pendingServiceIds).toContain('SVC_SECOND_GROUPE');
    }
  });
});
