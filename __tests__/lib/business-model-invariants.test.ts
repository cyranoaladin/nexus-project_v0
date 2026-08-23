/**
 * T16 — Business model invariants.
 *
 * Each test asserts ONE named invariant against pricing.canonical.json.
 * If ANY of these break, the business model is violated and the build
 * must fail. No silent pass — each rule is an explicit assertion.
 */

import { getFullPricingData } from '@/lib/pricing';

const data = getFullPricingData();

// ── Groupes ──
// Standard families stay capped at 5. Candidat individuel is its own family,
// capped at 6 (min 3) — see AnnualOffer.effectif_family in lib/pricing.ts.
// This is a per-family invariant, not a blanket relaxation: every other
// family (stages, scolarisé, ponctuel, coaching) is still asserted at 5.

describe('T16.1 — Groupes <= 5, sauf famille candidat individuel <= 6', () => {
  test('every standard annual offer has group_max <= 5', () => {
    for (const o of data.offers) {
      if (o.group_max != null && o.effectif_family !== 'candidat_individuel') {
        expect(o.group_max).toBeLessThanOrEqual(5);
      }
    }
  });

  test('every candidat individuel annual offer has 3 <= group_max <= 6', () => {
    const candidatIndividuelOffers = data.offers.filter((o) => o.effectif_family === 'candidat_individuel');
    expect(candidatIndividuelOffers.length).toBeGreaterThan(0);
    for (const o of candidatIndividuelOffers) {
      if (o.group_max != null) {
        expect(o.group_max).toBeLessThanOrEqual(6);
        expect(o.group_min_open).toBe(3);
      }
    }
  });

  test('every stage format has group_max <= 5', () => {
    for (const f of data.stage_formats) {
      expect(f.group_max).toBeLessThanOrEqual(5);
    }
  });

  test('every ponctuel offer with group_max has group_max <= 5', () => {
    for (const p of data.ponctuel_offers) {
      if (p.group_max != null) {
        expect(p.group_max).toBeLessThanOrEqual(5);
      }
    }
  });

  test('every coaching group offer with group_max has group_max <= 5', () => {
    for (const c of data.coaching) {
      if (c.group_max != null) {
        expect(c.group_max).toBeLessThanOrEqual(5);
      }
    }
  });
});

// ── Mensuel ──

describe('T16.2 — No legacy annual / 10 monthly display', () => {
  test('no priced annual offer exposes monthly_display', () => {
    for (const o of data.offers) {
      if (o.price_annual == null) continue;
      expect((o as unknown as Record<string, unknown>).monthly_display).toBeUndefined();
    }
  });
});

// ── Échéancier ──

describe('T16.3 — Échéancier somme == annuel', () => {
  test('deposit + installments == price_annual for every priced offer', () => {
    let checked = 0;
    for (const o of data.offers) {
      if (o.price_annual == null) continue;
      if (o.deposit == null || o.installment_amount == null) continue;
      // Every priced offer with deposit MUST have complete schedule
      expect(o.n_installments).not.toBeNull();
      expect(o.last_installment).not.toBeNull();
      const total = o.deposit + (o.n_installments! - 1) * o.installment_amount + o.last_installment!;
      expect(total).toBe(o.price_annual);
      checked++;
    }
    // 27 annual offers have deposit+installments (4 without: 2nde-coaching + 3 plateformes).
    // 21 legacy scolarisé/libre offers + 6 new candidat individuel offers (deposit: 0 counts,
    // since 0 !== null) = 27. See __tests__/lib/candidat-individuel-pricing.test.ts for the
    // explicit per-offer amounts.
    expect(checked).toBe(27);
  });

  test('stage format deposit + solde == price_per_student', () => {
    for (const f of data.stage_formats) {
      const total = f.payment.deposit + f.payment.solde;
      expect(total).toBe(f.price_per_student);
    }
  });
});

// ── Nexus Select ──

describe('T16.4 — Nexus Select arithmetic', () => {
  const ns = (data as any).special_programs?.find((p: any) => p.id === 'nexus-select');

  test('exists in canonical', () => {
    expect(ns).toBeDefined();
  });

  test('deposit + solde == price (540 + 1260 == 1800)', () => {
    expect(ns.payment.deposit + ns.payment.solde).toBe(ns.price_per_student);
  });

  test('price / hours == price_per_student_hour (1800 / 40 == 45)', () => {
    expect(Math.round(ns.price_per_student / ns.hours)).toBe(ns.price_per_student_hour);
  });
});

// ── Plancher stage ──

describe('T16.5 — Plancher stage >= 420 TND', () => {
  test('every stage format price >= 420', () => {
    for (const f of data.stage_formats) {
      expect(f.price_per_student).toBeGreaterThanOrEqual(420);
    }
  });
});

// ── Retenue premium ──

describe('T16.6 — Retenue premium (0 prix barre, 0 chiffre inverifiable)', () => {
  test('no offer has price_annual_public (prix barre)', () => {
    for (const o of data.offers) {
      expect((o as any).price_annual_public).toBeUndefined();
    }
  });

  test('no offer has badge "campagne"', () => {
    for (const o of data.offers) {
      expect((o as any).badge).toBeUndefined();
    }
  });

  test('no pack has discount_pct or value', () => {
    for (const p of data.packs) {
      expect((p as any).discount_pct).toBeUndefined();
      expect((p as any).value).toBeUndefined();
    }
  });

  test('no "valeur reelle" string in canonical JSON', () => {
    const json = JSON.stringify(data);
    expect(json.toLowerCase()).not.toContain('valeur réelle');
    expect(json.toLowerCase()).not.toContain('valeur reelle');
  });
});
