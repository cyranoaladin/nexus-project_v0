/**
 * Pricing canonical validator — build guardrails (PROCEDURE §3 + CDC §7)
 * These tests MUST pass for the build to be green.
 * They protect against pricing invariant violations.
 */
import {
  getFullPricingData,
  getRules,
  getStageFormat,
  getStageEdition,
  getPonctuelOffer,
  getCoachingOffer,
  resolvePackValue,
  getCarte,
  type PricingData,
} from '@/lib/pricing';

let data: PricingData;

beforeAll(() => {
  data = getFullPricingData();
});

// ── T1: Effectif — group_max ≤ 5 everywhere ──

describe('T1 — Effectif group_max ≤ 5', () => {
  test('annual offers with group_max must be ≤ 5', () => {
    for (const offer of data.offers) {
      if (offer.group_max != null) {
        expect(offer.group_max).toBeLessThanOrEqual(5);
      }
    }
  });

  test('stage formats group_max ≤ 5', () => {
    for (const fmt of data.stage_formats) {
      expect(fmt.group_max).toBeLessThanOrEqual(5);
    }
  });

  test('ponctuel offers with group_max must be ≤ 5', () => {
    for (const p of data.ponctuel_offers) {
      if (p.group_max != null) {
        expect(p.group_max).toBeLessThanOrEqual(5);
      }
    }
  });

  test('coaching group offers group_max ≤ 5', () => {
    for (const c of data.coaching) {
      if (c.group_max != null) {
        expect(c.group_max).toBeLessThanOrEqual(5);
      }
    }
  });
});

// ── T2: Price floor — stage unitaire ≥ 45 TND/élève/h ──
// Business-ratified threshold (decision 2026-06-20): 45 TND/h applies to all stage formats.

describe('T2 — Stage price floor ≥ 45 TND/élève/h', () => {
  const stageFloor = 45;

  test('all stage formats respect floor', () => {
    for (const fmt of data.stage_formats) {
      expect(fmt.price_per_student_hour).toBeGreaterThanOrEqual(stageFloor);
    }
  });

  test('price_per_student_hour is consistent with price/hours for every format', () => {
    for (const fmt of data.stage_formats) {
      const computed = Math.round(fmt.price_per_student / fmt.hours);
      expect(fmt.price_per_student_hour).toBe(computed);
    }
  });

  test('ponctuel offers with floor_type=stage respect floor', () => {
    for (const p of data.ponctuel_offers) {
      if (p.floor_type === 'stage' && p.price_per_student_hour != null) {
        expect(p.price_per_student_hour).toBeGreaterThanOrEqual(stageFloor);
      }
    }
  });
});

// ── T3: Coaching 1:1 ≥ 180 TND/h ──

describe('T3 — Coaching 1:1 floor ≥ 180 TND/h', () => {
  test('boussole-individuel price_per_hour ≥ 180', () => {
    for (const c of data.coaching) {
      if (c.floor_type === 'coaching_1to1' && c.price_per_hour != null) {
        expect(c.price_per_hour).toBeGreaterThanOrEqual(180);
      }
    }
  });
});

// ── T4: Pack referential integrity ──

describe('T4 — Pack referential integrity', () => {
  const formatIds = new Set<string>();
  const editionIds = new Set<string>();
  const ponctuelIds = new Set<string>();
  const coachingIds = new Set<string>();

  beforeAll(() => {
    data.stage_formats.forEach((f) => formatIds.add(f.format_id));
    data.stage_editions.forEach((e) => editionIds.add(e.edition_id));
    data.ponctuel_offers.forEach((p) => ponctuelIds.add(p.id));
    data.coaching.forEach((c) => coachingIds.add(c.id));
  });

  test('every pack component references existing entities', () => {
    for (const pack of data.packs) {
      for (const comp of pack.components) {
        if (comp.type === 'stage') {
          expect(formatIds.has(comp.format_id!)).toBe(true);
          expect(editionIds.has(comp.edition_id!)).toBe(true);
        } else if (comp.type === 'ponctuel') {
          expect(ponctuelIds.has(comp.id!)).toBe(true);
        } else if (comp.type === 'coaching') {
          expect(coachingIds.has(comp.id!)).toBe(true);
        }
        // type 'service' has no ref to check
      }
    }
  });

  test('edition formats reference existing stage_formats', () => {
    for (const edition of data.stage_editions) {
      for (const fmtId of edition.formats) {
        expect(formatIds.has(fmtId)).toBe(true);
      }
    }
  });
});

// ── T5: Pack fields + monthly_display ──

describe('T5 — Pack pricing fields are clean', () => {
  test('no pack has deprecated value or discount_pct fields', () => {
    for (const pack of data.packs) {
      expect((pack as unknown as Record<string, unknown>).value).toBeUndefined();
      expect((pack as unknown as Record<string, unknown>).discount_pct).toBeUndefined();
    }
  });
});

describe('T5b — monthly_display = round(price_annual / 10)', () => {
  test('every offer with price_annual has correct monthly_display', () => {
    for (const offer of data.offers) {
      if (offer.price_annual == null) continue;
      const expected = Math.round(offer.price_annual / 10);
      expect(offer.monthly_display).toBe(expected);
    }
  });
});

// ── T7: Échéancier coherence ──

describe('T7 — Échéancier coherence', () => {
  test('annual offers: deposit + installments = price', () => {
    for (const offer of data.offers) {
      if (offer.deposit != null && offer.n_installments != null && offer.installment_amount != null && offer.last_installment != null) {
        const total = offer.deposit + offer.installment_amount * (offer.n_installments - 1) + offer.last_installment;
        expect(total).toBe(offer.price_annual);
      }
    }
  });

  test('stage formats: deposit + solde = price', () => {
    for (const fmt of data.stage_formats) {
      expect(fmt.payment.deposit + fmt.payment.solde).toBe(fmt.price_per_student);
    }
  });

  test('ponctuel offers: deposit + solde = price', () => {
    for (const p of data.ponctuel_offers) {
      if (p.payment.full_at_booking) {
        expect(p.payment.deposit).toBe(p.price_per_student);
      } else {
        expect(p.payment.deposit + p.payment.solde).toBe(p.price_per_student);
      }
    }
  });

  test('coaching offers: deposit + solde/schedule = price', () => {
    for (const c of data.coaching) {
      if (c.payment.full_at_booking) {
        expect(c.payment.deposit).toBe(c.price);
      } else if (c.payment.solde_schedule) {
        const total = c.payment.deposit + c.payment.solde_schedule.reduce((a, b) => a + b, 0);
        expect(total).toBe(c.price);
      } else if (c.payment.solde != null) {
        expect(c.payment.deposit + c.payment.solde).toBe(c.price);
      }
    }
  });

  test('packs: deposit + Σ solde_schedule = price', () => {
    for (const pack of data.packs) {
      const total = pack.payment.deposit + pack.payment.solde_schedule.reduce((a, b) => a + b, 0);
      expect(total).toBe(pack.price);
    }
  });
});

// ── T8: Carte not stackable on packs ──

describe('T8 — Carte discount not applied to packs', () => {
  test('carte_nexus.discount_excludes contains "packs"', () => {
    expect(data.carte_nexus.discount_excludes).toContain('packs');
  });

  test('carte_nexus.non_cumulable is true', () => {
    expect(data.carte_nexus.non_cumulable).toBe(true);
  });
});

// ── T9: Carte member floor ──

describe('T9 — Carte member floor ≥ 40 TND/h', () => {
  test('member_floor_per_student_hour = 40', () => {
    expect(data.carte_nexus.member_floor_per_student_hour).toBe(40);
  });

  test('applying 10% discount to every stage still respects 40 TND/h floor', () => {
    const carte = getCarte();
    for (const fmt of data.stage_formats) {
      const discounted = fmt.price_per_student * (1 - carte.discount_pct / 100);
      const discountedPerHour = discounted / fmt.hours;
      expect(discountedPerHour).toBeGreaterThanOrEqual(carte.member_floor_per_student_hour);
    }
  });
});

// ── T10: Anti-hardcode (check no TND amounts in component source) ──
// This test is structural — actual grep-based checking is separate.
// Here we validate the JSON has all required sections populated.

describe('T10 — JSON completeness (anti-hardcode enabler)', () => {
  test('stage_formats has 8 entries', () => {
    expect(data.stage_formats).toHaveLength(8);
  });

  test('stage_editions has 6 entries', () => {
    expect(data.stage_editions).toHaveLength(6);
  });

  test('ponctuel_offers has 4 entries', () => {
    expect(data.ponctuel_offers).toHaveLength(4);
  });

  test('coaching has 6 entries', () => {
    expect(data.coaching).toHaveLength(6);
  });

  test('packs has 6 entries', () => {
    expect(data.packs).toHaveLength(6);
  });

  test('carte_nexus exists with price 290', () => {
    expect(data.carte_nexus.price_annual).toBe(290);
  });
});

// ── T11: Anti-leak ──

describe('T11 — Anti-leak strings not in JSON', () => {
  test('no "a confirmer par la direction" in JSON values', () => {
    const json = JSON.stringify(data);
    expect(json).not.toContain('a confirmer par la direction');
    expect(json).not.toContain('à confirmer par la direction');
  });

  test('no "X TND les 2 h" pattern in JSON values', () => {
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/X TND les 2 h/i);
  });
});

describe('T12 — French labels keep required accents', () => {
  test('pricing canonical does not contain known unaccented public tokens', () => {
    const json = JSON.stringify(data);
    const forbiddenTokens = [
      'Specialite',
      'Francais',
      'methode',
      'Presentiel',
      'Strategique',
      'Epreuve',
      'Reservation',
      'Annee',
      'anticipee',
      'Securite',
      'Accompagnee',
      'reguliers',
      'corriges',
      'personnalise',
      'seances',
      'Mathematiques',
      'Premiere',
      'Troisieme',
    ];

    const offenders = forbiddenTokens.filter((token) => json.includes(token));
    expect(offenders).toEqual([]);
  });
});

// ── Additional invariants from PROCEDURE §3 ──

describe('Price floors per offer type', () => {
  const rules = getRules();

  test('single-subject offers ≥ 50 TND/h', () => {
    // Single-subject = 1 EDS only (not "Maths + methode" which is multi)
    const singleSubjectIds = ['term-spe-simple', '1re-eaf', '1re-maths-antic'];
    for (const offer of data.offers) {
      if (singleSubjectIds.includes(offer.id) && offer.price_per_student_hour != null) {
        expect(offer.price_per_student_hour).toBeGreaterThanOrEqual(rules.price_floor_per_student_hour_tnd.single);
      }
    }
  });

  test('multi-subject offers ≥ 45 TND/h', () => {
    // Multi = 2+ subjects or method combos (excludes college and single-subject)
    const singleSubjectIds = new Set(['term-spe-simple', '1re-eaf', '1re-maths-antic']);
    for (const offer of data.offers) {
      if (offer.price_per_student_hour != null && offer.track === 'scolarise' && offer.level !== 'troisieme' && !singleSubjectIds.has(offer.id)) {
        expect(offer.price_per_student_hour).toBeGreaterThanOrEqual(rules.price_floor_per_student_hour_tnd.multi);
      }
    }
  });

  test('college offers ≥ 40 TND/h', () => {
    for (const offer of data.offers) {
      if (offer.level === 'troisieme' && offer.price_per_student_hour != null) {
        expect(offer.price_per_student_hour).toBeGreaterThanOrEqual(rules.price_floor_per_student_hour_tnd.college);
      }
    }
  });
});

describe('Global discount cap = 20%', () => {
  test('rules.discounts.global_cap_pct = 20', () => {
    expect(data.rules.discounts.global_cap_pct).toBe(20);
  });

  test('no offer has deprecated price_annual_public or badge fields', () => {
    for (const offer of data.offers) {
      expect((offer as unknown as Record<string, unknown>).price_annual_public).toBeUndefined();
      expect((offer as unknown as Record<string, unknown>).price_annual_campaign).toBeUndefined();
      expect((offer as unknown as Record<string, unknown>).badge).toBeUndefined();
    }
  });
});

// ── T14: Anti-date-passée guard ──

describe('T14 — No past dates in stage calendar', () => {
  const LAUNCH_DATE = new Date('2026-08-01');

  test('every stage_calendar entry has dates >= launch date', () => {
    for (const entry of data.stage_calendar) {
      const start = new Date((entry as any).date_start);
      const end = new Date((entry as any).date_end);
      expect(start.getTime()).toBeGreaterThanOrEqual(LAUNCH_DATE.getTime());
      expect(end.getTime()).toBeGreaterThanOrEqual(LAUNCH_DATE.getTime());
    }
  });

  test('no fevrier2026 or 2025 references in canonical JSON', () => {
    const json = JSON.stringify(data);
    expect(json).not.toContain('fevrier2026');
    expect(json).not.toContain('fevrier-2026');
    expect(json.match(/"2025-/g)).toBeNull();
  });
});
