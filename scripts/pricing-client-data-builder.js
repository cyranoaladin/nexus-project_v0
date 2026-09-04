/**
 * Pure builder functions for the client-safe pricing data derived from
 * data/pricing.canonical.json — the SINGLE source of truth.
 *
 * Shared by:
 *   - scripts/generate-pricing-client-data.js  (CLI: writes the generated files)
 *   - __tests__/lib/pricing-client-sync.test.ts (proves generated == generate(canonical))
 *
 * No financial/business formula may be re-implemented anywhere else — every
 * consumer of the generated files must go through these two functions, and
 * every test asserting sync must call them rather than re-deriving the shape
 * inline.
 */

/** @param {any} canonical - parsed pricing.canonical.json */
function buildClientData(canonical) {
  const requiredKeys = [
    'rules',
    'reperes_tarifaires',
    'offers',
    'operational_subscription_plans',
    'operational_aria_addons',
    'operational_special_packs',
    'operational_credit_costs',
  ];
  for (const key of requiredKeys) {
    if (canonical[key] === undefined) {
      throw new Error(`Missing expected key "${key}" in pricing.canonical.json`);
    }
  }

  return {
    rules: canonical.rules,
    reperes_tarifaires: canonical.reperes_tarifaires,
    annual_offer_summaries: canonical.offers.map((offer) => ({
      id: offer.id,
      price_annual: offer.price_annual,
      deposit: offer.deposit,
      n_installments: offer.n_installments,
      installment_amount: offer.installment_amount,
      last_installment: offer.last_installment,
    })),
    operational_subscription_plans: canonical.operational_subscription_plans,
    operational_aria_addons: canonical.operational_aria_addons,
    operational_special_packs: canonical.operational_special_packs,
    operational_credit_costs: canonical.operational_credit_costs,
  };
}

/** @param {any} canonical - parsed pricing.canonical.json */
function buildMiniCalendar(canonical) {
  if (canonical.stage_calendar === undefined) {
    throw new Error('Missing expected key "stage_calendar" in pricing.canonical.json');
  }
  return canonical.stage_calendar.map((e) => ({
    id: e.id,
    title: e.title,
    date_start: e.date_start,
    dates_display: e.dates_display,
  }));
}

module.exports = { buildClientData, buildMiniCalendar };
