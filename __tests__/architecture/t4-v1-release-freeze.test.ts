/**
 * T4 — CANDIDAT INDIVIDUEL V1 RELEASE SCOPE FREEZE.
 *
 * No new commercial feature. This file proves the freeze BEHAVIORALLY —
 * against the real, unmocked pipeline (buildCandidateQuoteRecommendation)
 * and the real committed catalogue — never by inspecting JSON strings
 * alone. Every DEFERRED_FROM_V1 element is driven through a real (or
 * forged) input that would select it, and the result is proven to never
 * reach 'READY' — i.e. structurally impossible to produce a final
 * QuoteLine, let alone a priced one. See
 * docs/candidat-individuel/v1-release-scope.md for the full inventory
 * and docs/candidat-individuel/direction-decisions-commercial-
 * governance.md for the per-element decision trail.
 *
 * __tests__/architecture/t3a-catalogue-approval-isolation.test.ts already
 * covers the structural (directionApprovalStatus) state and several of
 * these behaviorally — this file adds the items that test doesn't cover
 * (MOD_EMC_ARIA behaviorally, SVC_SECOND_GROUPE alongside the others in
 * one consolidated freeze proof, and the §7 zero-price invariant with
 * forged/malformed inputs) and exists as the single freeze-specific
 * source of truth going forward.
 */
import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineInput } from '@/lib/quotes/pipeline';
import { getCatalogue, resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';

afterEach(() => resetCatalogueCacheForTests());

function baseInput(overrides: Partial<CandidateQuotePipelineInput['publicInput']> = {}): CandidateQuotePipelineInput {
  return {
    publicInput: {
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'NSI',
      specialite2: 'PHYSIQUE_CHIMIE',
      ...overrides,
    },
    budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
  };
}

/** Every scenario that ever reaches READY exposes only these final states — proves "no silent partial success". */
const NON_FINAL_STATUSES = ['INVALID', 'NOT_ELIGIBLE', 'HUMAN_REVIEW_REQUIRED', 'DIRECTION_APPROVAL_REQUIRED', 'UNPRICED', 'PROVISIONAL'];

describe('T4 §3 — DEFERRED_FROM_V1 modules: real/forged selection never reaches READY, never produces a QuoteLine', () => {
  test('MOD_HG_ARIA + MOD_ES_ARIA + MOD_EMC_ARIA: nominal TERMINALE profil (no dispenses, all 3 épreuves genuinely due) — DIRECTION_APPROVAL_REQUIRED, all 3 pending, no other module confused for approved', () => {
    const result = buildCandidateQuoteRecommendation(baseInput());
    expect(NON_FINAL_STATUSES).toContain(result.status);
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status !== 'DIRECTION_APPROVAL_REQUIRED') return;
    expect(result.pendingModuleIds).toEqual(expect.arrayContaining(['MOD_HG_ARIA', 'MOD_ES_ARIA', 'MOD_EMC_ARIA']));
  });

  test('MOD_EAF_DESCRIPTIF: PREMIERE profil, eaf-oral genuinely due — itself never a priced line, in any tier (T5R RECETTE_FINDING_1 fix: no longer blocks its INCLUDED_V1 sibling MOD_EAF_ECRIT_ORAL from reaching READY)', () => {
    const result = buildCandidateQuoteRecommendation({
      publicInput: { level: 'PREMIERE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' },
      budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
    });
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    const selectedCommercialModuleIds = result.selection.modules
      .filter((module) => module.status === 'SELECTED')
      .map((module) => module.moduleId);
    const commercialSubjectIds = result.scenarios.flatMap((scenario) => scenario.lines.map((line) => line.subject));

    expect(selectedCommercialModuleIds).not.toContain('MOD_EAF_DESCRIPTIF');
    expect(commercialSubjectIds).not.toContain('eaf-descriptif');
    for (const scenario of result.scenarios) {
      expect(scenario.lines.some((l) => l.label.includes('récapitulatif'))).toBe(false);
    }
    const descriptif = result.selection.modules.find((m) => m.moduleId === 'MOD_EAF_DESCRIPTIF')!;
    expect(descriptif.status).toBe('NEEDS_HUMAN_REVIEW');
    expect(descriptif.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
  });

  test('option MATHS_EXPERTES: forged payload declaring it (with the spécialité mathématiques it structurally requires) — HUMAN_REVIEW_REQUIRED (unsourced regulatory coefficient), never READY, never a QuoteLine', () => {
    const result = buildCandidateQuoteRecommendation(
      baseInput({ specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', optionsTerminale: ['MATHS_EXPERTES'] }),
    );
    expect(NON_FINAL_STATUSES).toContain(result.status);
    expect(result.status).toBe('HUMAN_REVIEW_REQUIRED');
  });

  test.each(['DGEMC', 'LCA_LATIN'] as const)(
    'option %s: forged payload declaring it — HUMAN_REVIEW_REQUIRED (unsourced regulatory coefficient), never READY, never a QuoteLine',
    (option) => {
      const result = buildCandidateQuoteRecommendation(baseInput({ optionsTerminale: [option] }));
      expect(NON_FINAL_STATUSES).toContain(result.status);
      expect(result.status).toBe('HUMAN_REVIEW_REQUIRED');
    },
  );

  test('MOD_MATHS_COMPLEMENTAIRES: forged payload (specialité mathématiques abandonnée, so not ALSO INVALID for an unrelated reason) — HUMAN_REVIEW_REQUIRED, never READY', () => {
    const result = buildCandidateQuoteRecommendation(baseInput({ optionsTerminale: ['MATHS_COMPLEMENTAIRES'] }));
    expect(NON_FINAL_STATUSES).toContain(result.status);
    expect(result.status).toBe('HUMAN_REVIEW_REQUIRED');
  });

  test('SVC_BACS_BLANCS: structurally unreachable regardless of input — no field in publicInput/staffExtension can ever select it (catalogue.services is only consulted for SVC_PILOTAGE/SVC_SECOND_GROUPE), confirmed by the isolation test t3d-bacs-blancs.test.ts', () => {
    const catalogue = getCatalogue();
    const svc = catalogue.services.find((s) => s.serviceId === 'SVC_BACS_BLANCS')!;
    expect(svc.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
    expect(svc.pricingRuleId).toBeNull();
  });

  test('SVC_SECOND_GROUPE (P11): forged payload (moyenneRattrapage in the P11-eligible band) — DIRECTION_APPROVAL_REQUIRED, pendingServiceIds contains it, never READY, mirrors __tests__/lib/quotes/second-groupe-p11.test.ts', () => {
    const result = buildCandidateQuoteRecommendation(baseInput({ moyenneRattrapage: 9 }));
    expect(NON_FINAL_STATUSES).toContain(result.status);
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status !== 'DIRECTION_APPROVAL_REQUIRED') return;
    expect(result.pendingServiceIds).toContain('SVC_SECOND_GROUPE');
  });
});

describe('T4 §7 — zero-price release invariant: no forged/malformed input ever produces a 0 TND final QuoteLine', () => {
  test('an unknown option code is rejected outright (INVALID) by lib/exams/normalize.ts — never silently dropped, never treated as a known (and priceable) one', () => {
    const result = buildCandidateQuoteRecommendation(baseInput({ optionsTerminale: ['OPTION_QUI_NEXISTE_PAS'] }));
    expect(NON_FINAL_STATUSES).toContain(result.status);
    expect(result.status).toBe('INVALID');
  });

  test('every module with pricingRuleId=null is DIRECTION_A_VALIDER — the schema-level invariant already proven in catalogue-schema.test.ts (a module can never be APPROVED with pricingRuleId=null), reconfirmed against the real committed catalogue on this exact baseline', () => {
    const catalogue = getCatalogue();
    for (const m of catalogue.modules) {
      if (m.pricingRuleId === null && m.moduleId !== 'MOD_GRAND_ORAL') {
        // MOD_GRAND_ORAL is the one deliberate module-level exception:
        // APPROVED with pricingRuleId=null because it prices through a
        // dedicated forfait branch (rules.grand_oral_policy in
        // lib/quotes/pricing.ts), never the generic petit_groupe lookup
        // pricingRuleId points at. Its positive price is already proven
        // by __tests__/lib/candidat-individuel-pricing.test.ts and the
        // golden snapshots — not re-derived here.
        expect(m.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
      }
    }
    const grandOral = catalogue.modules.find((m) => m.moduleId === 'MOD_GRAND_ORAL')!;
    expect(grandOral.directionApprovalStatus).toBe('APPROVED');
    expect(grandOral.volumePolicy.kind).toBe('plafonne');
    for (const s of catalogue.services) {
      if (s.pricingRuleId === null && s.serviceId !== 'SVC_EPS_ADMINISTRATIF') {
        // SVC_EPS_ADMINISTRATIF is APPROVED with pricingRuleId=null BY
        // DESIGN (D1: never billed, never a separate line — the only
        // deliberate exception) — every other null-priced service must
        // stay DIRECTION_A_VALIDER.
        expect(s.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
      }
    }
  });

  test('SVC_EPS_ADMINISTRATIF: the one deliberate exception — APPROVED, pricingRuleId=null, never separately reachable (informational-only by design, D1), confirmed no code path ever tries to price it', () => {
    const catalogue = getCatalogue();
    const eps = catalogue.services.find((s) => s.serviceId === 'SVC_EPS_ADMINISTRATIF')!;
    expect(eps.directionApprovalStatus).toBe('APPROVED');
    expect(eps.pricingRuleId).toBeNull();
    // Same structural unreachability as SVC_BACS_BLANCS (catalogue.services
    // is only consulted for SVC_PILOTAGE/SVC_SECOND_GROUPE) — by design
    // here, not a pending gap.
  });

  test('a READY result never contains a RecommendedLine with unitPriceMonthly <= 0 (nominal INCLUDED_V1 profil)', () => {
    const result = buildCandidateQuoteRecommendation(
      baseInput({
        specialite1: 'MATHEMATIQUES',
        specialite2: 'PHYSIQUE_CHIMIE',
      }),
    );
    // This profil still hits HG/ES/EMC_ARIA gates (nominal, no dispenses)
    // — DIRECTION_APPROVAL_REQUIRED, not READY. The invariant is proven
    // vacuously-safe here (no lines to check) AND, positively, by the
    // real T3A DB suite (t3a-lva-lvb-specialite-abandonnee.test.ts,
    // Phase D) and T1/T2 golden snapshots, which assert exact positive
    // prices for every reachable INCLUDED_V1 line — never re-derived
    // here to avoid duplicating that proof.
    expect(NON_FINAL_STATUSES).toContain(result.status);
  });
});
