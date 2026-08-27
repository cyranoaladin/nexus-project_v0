/**
 * T3D — SVC_BACS_BLANCS readiness audit. No activation in this lot — see
 * docs/candidat-individuel/direction-decisions-commercial-governance.md
 * §3 (`SVC_BACS_BLANCS` entry) for the full trace.
 *
 * §1/§2 (commercial audit, before any code): both PRICE_SEMANTICS and
 * COST_SEMANTICS are AMBIGUOUS.
 *   - Price: the only documented "1/2/3 bacs blancs/an" proposal
 *     (matrice-commerciale-detaillee-lot-fermeture-p11-p3.md §12) is
 *     self-annotated `[hypothèse Claude — jamais approuvée]` and closes
 *     with "Décision attendue" (a request, not a recorded decision). A
 *     later, distinct document (recablage-matrice-14-arbitrages.md)
 *     directly contradicts the "déjà clarifié" claim made elsewhere,
 *     describing the service as still "Non défini... Décision de
 *     direction requise". The mission explicitly warned not to take
 *     "déjà clarifié" as authoritative without proof — this audit found
 *     none; the opposite, in fact.
 *   - Cost: lib/quotes/margin.server.ts::computeMargin is strictly
 *     hours-based (teacherCostPerHourTnd × hoursPerMonth, split by group
 *     size for GROUPE/DUO) — it has no representation for a discrete
 *     per-correction cost split across two intervenant categories (the
 *     matrice's own 41,25 TND/bac model: 30min certifié + 15min
 *     tuteur/structure). The two cost models are not interchangeable;
 *     the matrice's 56,6% margin figure is not runtime-verifiable today.
 *
 * §3 (reachability, confirmed against the real code, not just docs):
 * resolveCatalogueModules (lib/quotes/catalogue.ts) iterates exclusively
 * catalogue.modules — catalogue.services is consulted at exactly two
 * hardcoded call sites (SVC_PILOTAGE in coverageItemsForSelection,
 * SVC_SECOND_GROUPE in pipeline.ts's dedicated P11 branch).
 * SVC_BACS_BLANCS is therefore structurally unreachable today — already
 * proven behaviorally by
 * __tests__/architecture/t3a-catalogue-approval-isolation.test.ts's
 * existing "structurally unreachable" test; this file adds the
 * structural (coverageItemsForSelection-level) confirmation and locks in
 * the current catalogue state so a future lot cannot silently activate
 * on an unresolved semantics.
 *
 * No dedicated resolver is built in this lot (§4's generic-loop warning
 * moot: nothing is wired at all).
 */
import { getCatalogue, resetCatalogueCacheForTests, coverageItemsForSelection, type CatalogueSelection } from '@/lib/quotes/catalogue';

afterEach(() => resetCatalogueCacheForTests());

describe('T3D §1/§2 — price/cost semantics ambiguity lock-in (structural state only, no invented interpretation)', () => {
  test('SVC_BACS_BLANCS stays pricingRuleId=null, inclusionPolicy=inclus_uniquement, DIRECTION_A_VALIDER — the 95/190/285 TND numbers are approved, their unit is not', () => {
    const catalogue = getCatalogue();
    const svc = catalogue.services.find((s) => s.serviceId === 'SVC_BACS_BLANCS');
    expect(svc).toBeDefined();
    expect(svc!.pricingRuleId).toBeNull();
    expect(svc!.inclusionPolicy).toBe('inclus_uniquement');
    expect(svc!.directionApprovalStatus).toBe('DIRECTION_A_VALIDER');
  });
});

describe('T3D §3 — reachability: SVC_BACS_BLANCS never contributes a coverage item, under any selection shape', () => {
  function fakeSelection(overrides: Partial<CatalogueSelection> = {}): CatalogueSelection {
    return {
      pilotageIncluded: true,
      parcoursPrincipal: 'P1',
      necessiteVerificationHumaine: false,
      emissionAutomatiqueAutorisee: true,
      modules: [],
      ...overrides,
    };
  }

  test('pilotage-only selection: coverage items are exactly the Pilotage bundle, never BACS_BLANCS', () => {
    const catalogue = getCatalogue();
    const pilotage = catalogue.services.find((s) => s.serviceId === 'SVC_PILOTAGE')!;
    const items = coverageItemsForSelection(fakeSelection());
    expect(items.map((i) => i.coverageKey)).toEqual(pilotage.coverageKeys);
    expect(items.map((i) => i.coverageKey)).not.toContain('BACS_BLANCS');
  });

  test('a SELECTED module in the fixture selection never causes BACS_BLANCS to appear either — coverageItemsForSelection only ever reads selection.modules + the hardcoded SVC_PILOTAGE lookup, never catalogue.services generically', () => {
    const items = coverageItemsForSelection(
      fakeSelection({
        modules: [
          {
            moduleId: 'MOD_FIXTURE',
            label: 'fixture',
            coverageKey: 'FIXTURE_KEY',
            epreuveCodes: [],
            optionCodes: [],
            deliveryMode: 'petit_groupe',
            pricingRuleId: null,
            volumePolicy: { kind: 'direction_a_valider', noteArbitrage: 'fixture' },
            inclusionPolicy: 'vendable_separement',
            directionApprovalStatus: 'DIRECTION_A_VALIDER',
            status: 'SELECTED',
            reason: 'fixture',
            coefficientEffectif: null,
          },
        ],
      }),
    );
    expect(items.map((i) => i.coverageKey)).not.toContain('BACS_BLANCS');
  });
});
