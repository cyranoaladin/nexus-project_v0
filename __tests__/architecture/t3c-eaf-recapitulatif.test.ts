/**
 * T3C — EAF récapitulatif/descriptif readiness (MOD_EAF_DESCRIPTIF). No
 * activation in this lot — see file header conclusions below and
 * docs/candidat-individuel/direction-decisions-commercial-governance.md
 * §3 (`MOD_EAF_DESCRIPTIF` entry).
 *
 * Phase 1 (regulatory/terminology): the repo already cited the correct
 * regulatory instrument generically ("BO spécial 2019/2020",
 * docs/audit-reglementaire-bac-candidats-libres-nexus.md:20) — this lot
 * only makes the citation precise (note de service du 23 juillet 2020,
 * NOR MENE2019312N) and aligns the USER-FACING label with the regulatory
 * fact that individual candidates constitute their own récapitulatif —
 * Nexus's service is méthodological help, not doing it for them (already
 * the product's own description in lot5-fiches-arbitrage-volumes.md
 * Fiche 4: "accompagnement méthodologique... aide à la constitution").
 * The internal moduleId `MOD_EAF_DESCRIPTIF` is deliberately NOT renamed
 * (mission: "ne fais aucun renommage massif d'ID").
 *
 * Phase 2 (commercial): PRICE_UNIT_SEMANTICS = AMBIGUOUS. Traced through
 * three independent sources, none of which ever became an actual
 * decision: (a) the catalogue's own noteArbitrage says the volume is
 * "implicite dans MOD_EAF_ECRIT_ORAL", not a sourced standalone unit; (b)
 * the origin proposal (lot5-fiches-arbitrage-volumes.md Fiche 4) offers
 * three unlabeled "hypothèses" (1/2/3 séances) under its OWN
 * DIRECTION_A_VALIDER price section, and its actual recommendation is to
 * NOT create a separate billable line at all unless the combined EAF
 * volume is proven insufficient; (c) the governance registry records only
 * "Prix 180/360/540 TND = APPROVED" — the three numbers, never what a
 * tier represents. Per the mission's explicit warning, this must NOT be
 * assumed to be sessions, descriptifs, or a named tier (Essentiel/
 * Recommandé/Intensif) without proof — none exists. No dedicated pricing
 * path is implemented in this lot as a result (Phase 5 skipped).
 *
 * Phase 3 (architecture): confirmed, via the real pipeline (not
 * documentation alone), that MOD_EAF_DESCRIPTIF's blocker chain is
 * DIFFERENT from the T3B1 options: it has no carte-level regulatory
 * coefficient gate (eaf-oral is a normally-sourced ANTICIPEE épreuve,
 * coefficient 5) — its sole blocker is directionApprovalStatus
 * (pipeline.ts step 6's pendingModuleIds gate), reaching
 * DIRECTION_APPROVAL_REQUIRED. Proven below: if directionApprovalStatus
 * alone were flipped to APPROVED without also building a dedicated path,
 * the pipeline would proceed past that gate and fall into
 * modulesNonRepresentables at step 8 (MODULE_LEGACY_MAPPING has no entry
 * for it, correctly — forcing one would require inventing an hours/
 * priority-tier semantics for a ponctuel administrative-support service,
 * which is not what it is). A P11-style dedicated path is confirmed as
 * the correct future model — not built here, since PRICE_UNIT_SEMANTICS
 * is unresolved and building the path now would risk baking in an
 * unproven unit assumption.
 *
 * Phase 4 (nature du produit): ponctuel/administrative-support, not a
 * regular GROUPE subject — confirmedHeadcountBySubject/SOLO-DUO-GROUPE
 * deliberately NOT applied to it anywhere in this lot.
 */
import { getCatalogue, resetCatalogueCacheForTests, adaptCatalogueSelectionToExamProfile } from '@/lib/quotes/catalogue';
import { buildCandidateQuoteRecommendation } from '@/lib/quotes/pipeline';

afterEach(() => resetCatalogueCacheForTests());

describe('T3C Phase 1 — terminology', () => {
  test('the catalogue label reflects the regulatory fact (candidate constitutes their own récapitulatif; Nexus helps), moduleId unchanged (internal historical id, never renamed)', () => {
    const catalogue = getCatalogue();
    const m = catalogue.modules.find((mod) => mod.moduleId === 'MOD_EAF_DESCRIPTIF');
    expect(m).toBeDefined();
    expect(m!.moduleId).toBe('MOD_EAF_DESCRIPTIF');
    expect(m!.label).toBe('Aide au récapitulatif des activités EAF');
  });
});

describe('T3C Phase 2 — PRICE_UNIT_SEMANTICS = AMBIGUOUS (lock-in, so nobody silently activates on an unproven unit assumption)', () => {
  test('pricingRuleId stays null and volumePolicy stays direction_a_valider — the 180/360/540 price table is approved as numbers, never as a unit semantics', () => {
    const catalogue = getCatalogue();
    const m = catalogue.modules.find((mod) => mod.moduleId === 'MOD_EAF_DESCRIPTIF')!;
    expect(m.pricingRuleId).toBeNull();
    expect(m.volumePolicy.kind).toBe('direction_a_valider');
    expect(m.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
  });

  test('the catalogue noteArbitrage still documents the volume as implicit in MOD_EAF_ECRIT_ORAL, not a sourced standalone unit', () => {
    const catalogue = getCatalogue();
    const m = catalogue.modules.find((mod) => mod.moduleId === 'MOD_EAF_DESCRIPTIF')!;
    expect(m.volumePolicy.kind === 'direction_a_valider' ? m.volumePolicy.noteArbitrage : '').toMatch(/implicite dans MOD_EAF_ECRIT_ORAL/);
  });
});

describe('T3C Phase 3 — architecture: dedicated path required, MODULE_LEGACY_MAPPING deliberately not used', () => {
  test('MOD_EAF_DESCRIPTIF has no MODULE_LEGACY_MAPPING entry — a hand-built SELECTED module falls into modulesNonRepresentables, never a silently-invented subject line', () => {
    const fakeSelection = {
      pilotageIncluded: true,
      parcoursPrincipal: 'P1',
      necessiteVerificationHumaine: false,
      emissionAutomatiqueAutorisee: true,
      modules: [
        {
          moduleId: 'MOD_EAF_DESCRIPTIF',
          label: 'Aide au récapitulatif des activités EAF',
          coverageKey: 'EAF_DESCRIPTIF',
          epreuveCodes: ['eaf-oral'],
          optionCodes: [],
          deliveryMode: 'individuel_presentiel' as const,
          pricingRuleId: null,
          volumePolicy: { kind: 'direction_a_valider' as const, noteArbitrage: 'fixture' },
          inclusionPolicy: 'inclus_uniquement' as const,
          directionApprovalStatus: 'APPROVED' as const, // fixture-only hypothetical: what if it were flipped, without a dedicated path
          status: 'SELECTED' as const,
          reason: 'fixture',
          coefficientEffectif: 5,
        },
      ],
    };
    const adapted = adaptCatalogueSelectionToExamProfile(fakeSelection);
    expect(adapted.modulesNonRepresentables).toEqual(['MOD_EAF_DESCRIPTIF']);
    expect(adapted.emissionAutomatiqueAutorisee).toBe(false);
  });

  test("today's real, unmocked pipeline: MOD_EAF_DESCRIPTIF stays DIRECTION_A_VALIDER and is never priced, but (T5R RECETTE_FINDING_1 fix) no longer blocks its INCLUDED_V1 sibling MOD_EAF_ECRIT_ORAL, which shares the same eaf-oral épreuve", () => {
    // Before T5R: this exact profil returned DIRECTION_APPROVAL_REQUIRED
    // (pendingModuleIds=[MOD_EAF_DESCRIPTIF]) — MOD_EAF_ECRIT_ORAL could
    // never reach READY. Fixed via isPendingModuleBlocking
    // (lib/quotes/catalogue.ts): a pending module never blocks emission
    // when its own épreuve is already matched by an approved sibling.
    const result = buildCandidateQuoteRecommendation({
      publicInput: { level: 'PREMIERE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    });
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.selection.modules.find((m) => m.moduleId === 'MOD_EAF_DESCRIPTIF')!.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
    // The eaf-oral épreuve itself is normally coefficient-sourced — no
    // OPTION_COEFFICIENT_NON_SOURCE-style regulatory gate applies to it.
    const eafEpreuve = result.carte.epreuves.find((e) => e.code === 'eaf-oral');
    expect(eafEpreuve).toBeDefined();
    expect(eafEpreuve!.coefficientEffectif).toBe(5);
    expect(eafEpreuve!.necessiteVerificationHumaine).toBe(false);
  });
});

describe('T3C Phase 4/§6 — nature du produit + fail-closed: no scenario ever contains a MOD_EAF_DESCRIPTIF line today, under any budget/strategy, and no headcount mechanism is applied to it', () => {
  test.each(['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE'] as const)(
    "strategy=%s: a real profil where eaf-oral is genuinely due reaches READY (T5R fix) via its INCLUDED_V1 sibling MOD_EAF_ECRIT_ORAL, but MOD_EAF_DESCRIPTIF itself is never a priced line — no unitPrice<=0, no QuoteLine for it at all",
    (strategy) => {
      const result = buildCandidateQuoteRecommendation({
        publicInput: { level: 'PREMIERE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' },
        budget: { monthlyBudgetTnd: 5000, strategy },
      });
      expect(result.status).toBe('READY');
      if (result.status !== 'READY') return;
      for (const scenario of result.scenarios) {
        expect(scenario.lines.some((l) => l.label.includes('récapitulatif'))).toBe(false);
      }
    },
  );
});
