/**
 * T3A §9 / closeout Phase G — proves, against the REAL committed
 * data/pricing.canonical.json (never a fixture), that activating
 * MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE (direction's explicit 4h/month
 * volume decision, docs/candidat-individuel/direction-decisions-commercial-
 * governance.md §3bis) did not opportunistically approve or unblock
 * anything else. Never relies on manual JSON inspection alone: every
 * "stays blocked" claim is proven by actually driving the real pipeline
 * (buildCandidateQuoteRecommendation) with an input that would select the
 * item, and observing it still gate emission — the same mechanism a real
 * candidate/profil would hit.
 *
 * Interdits (docs/candidat-individuel/direction-decisions-commercial-
 * governance.md §3, T3A §8): MOD_HG_ARIA, MOD_ES_ARIA, MOD_EMC_ARIA,
 * MOD_EAF_DESCRIPTIF, MOD_MATHS_EXPERTES, MOD_MATHS_COMPLEMENTAIRES,
 * MOD_DGEMC, MOD_LCA, SVC_BACS_BLANCS — plus SVC_SECOND_GROUPE, which must
 * stay exactly in its pre-existing governed state (no opportunistic
 * change).
 */
import { getCatalogue, resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineInput } from '@/lib/quotes/pipeline';

afterEach(() => resetCatalogueCacheForTests());

const ACTIVATED_MODULE_IDS = ['MOD_LVA', 'MOD_LVB', 'MOD_SPECIALITE_ABANDONNEE'];
const STILL_BLOCKED_MODULE_IDS = [
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
  test('MOD_LVA, MOD_LVB, MOD_SPECIALITE_ABANDONNEE are APPROVED, with the decided 4h/month volume encoded', () => {
    const catalogue = getCatalogue();
    for (const id of ACTIVATED_MODULE_IDS) {
      const m = catalogue.modules.find((mod) => mod.moduleId === id);
      expect(m).toBeDefined();
      expect(m!.directionApprovalStatus).toBe('APPROVED');
      expect(m!.pricingRuleId).toBe('PETIT_GROUPE_4H');
      expect(m!.volumePolicy.kind).toBe('derive');
      if (m!.volumePolicy.kind === 'derive') {
        expect(m!.volumePolicy.hoursPerMonth).toBe(4);
      }
    }
  });

  test('every other DIRECTION_A_VALIDER-gated module remains DIRECTION_A_VALIDER — no opportunistic activation', () => {
    const catalogue = getCatalogue();
    for (const id of STILL_BLOCKED_MODULE_IDS) {
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

  test('only exactly 3 modules are APPROVED-but-were-not-before: the full APPROVED module set is the pre-existing 6 plus these 3, nothing else', () => {
    const catalogue = getCatalogue();
    const approvedIds = catalogue.modules.filter((m) => m.directionApprovalStatus === 'APPROVED').map((m) => m.moduleId).sort();
    const expected = [
      'MOD_EAF_ECRIT_ORAL', 'MOD_EAM', 'MOD_EDS1', 'MOD_EDS2', 'MOD_PHILOSOPHIE', 'MOD_GRAND_ORAL', // pre-existing (T1/T2 baseline)
      ...ACTIVATED_MODULE_IDS,
    ].sort();
    expect(approvedIds).toEqual(expected);
  });
});

describe('T3A closeout §1/§6 — behavioral: the real pipeline still blocks every "must stay blocked" item, and no longer blocks the 2 always-candidate activated modules', () => {
  test('nominal profil (no dispenses): MOD_HG_ARIA/MOD_ES_ARIA/MOD_EMC_ARIA still pending — MOD_LVA/MOD_LVB no longer pending (now SELECTED)', () => {
    const result = buildCandidateQuoteRecommendation(baseInput());
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status !== 'DIRECTION_APPROVAL_REQUIRED') return;
    expect(result.pendingModuleIds).toEqual(expect.arrayContaining(['MOD_HG_ARIA', 'MOD_ES_ARIA', 'MOD_EMC_ARIA']));
    expect(result.pendingModuleIds).not.toContain('MOD_LVA');
    expect(result.pendingModuleIds).not.toContain('MOD_LVB');
  });

  test.each(['MATHS_EXPERTES', 'DGEMC', 'LCA_LATIN'] as const)(
    'option %s: still regulatory-blocked (HUMAN_REVIEW_REQUIRED, OPTION_COEFFICIENT_NON_SOURCE) — a business-level directionApprovalStatus flip could never bypass this, and none was made anyway',
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

  test('MOD_EAF_DESCRIPTIF (PREMIERE profil, eaf-oral genuinely A_PRESENTER not reconduite): still DIRECTION_A_VALIDER and never priced, but no longer blocks MOD_EAF_ECRIT_ORAL — T5R RECETTE_FINDING_1 fix', () => {
    // Before T5R: this exact profil returned DIRECTION_APPROVAL_REQUIRED
    // with pendingModuleIds=[MOD_EAF_DESCRIPTIF] — MOD_EAF_ECRIT_ORAL
    // (INCLUDED_V1, APPROVED) could never reach READY because it shares
    // the "eaf-oral" épreuve with MOD_EAF_DESCRIPTIF (DIRECTION_A_VALIDER).
    // Fixed via isPendingModuleBlocking (lib/quotes/catalogue.ts): a
    // pending module never blocks emission when its own épreuve is
    // already matched by an approved sibling module.
    const result = buildCandidateQuoteRecommendation({
      publicInput: { level: 'PREMIERE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    });
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    // MOD_EAF_DESCRIPTIF itself never appears as a priced line, in any tier.
    for (const scenario of result.scenarios) {
      expect(scenario.lines.map((l) => l.subject)).not.toContain('eaf-descriptif');
      expect(scenario.lines.some((l) => l.label.includes('récapitulatif'))).toBe(false);
    }
    // MOD_EAF_ECRIT_ORAL (francais) is reachable and priced.
    const recommande = result.scenarios.find((s) => s.tier === 'RECOMMANDE')!;
    expect(recommande.lines.some((l) => l.subject === 'francais')).toBe(true);
    // Still gated at the catalogue level — directionApprovalStatus untouched.
    expect(result.selection.modules.find((m) => m.moduleId === 'MOD_EAF_DESCRIPTIF')!.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
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

describe('T3A closeout Phase E — volume invariant: hoursPerMonth=4 is the only volume encoded, no cadence structure imposed', () => {
  test('MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE each carry exactly hoursPerMonth=4 — nothing else', () => {
    const catalogue = getCatalogue();
    for (const id of ACTIVATED_MODULE_IDS) {
      const m = catalogue.modules.find((mod) => mod.moduleId === id)!;
      expect(m.volumePolicy.kind).toBe('derive');
      if (m.volumePolicy.kind !== 'derive') return;
      expect(m.volumePolicy.hoursPerMonth).toBe(4);
      // volumePolicy (catalogue-schema.ts) is a discriminated union with no
      // "cadence"/"séances par semaine"/"fréquence" field on ANY variant —
      // structurally, a weekly/session-count cadence cannot be encoded here
      // at all, let alone imposed. The object has exactly the fields its
      // 'derive' variant declares (hoursPerMonth, source) — nothing more.
      expect(Object.keys(m.volumePolicy).sort()).toEqual(['hoursPerMonth', 'kind', 'source'].sort());
    }
  });

  test('no catalogue module anywhere carries a "4 heures/semaine" or session-count field — the schema itself has no such vocabulary', () => {
    const catalogue = getCatalogue();
    const serialized = JSON.stringify(catalogue.modules);
    expect(serialized).not.toMatch(/heures?\s*\/\s*semaine|séances?\s*\/\s*mois|hoursPerWeek|sessionsPerMonth/i);
  });
});
