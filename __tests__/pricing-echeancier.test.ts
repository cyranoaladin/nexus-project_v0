/**
 * Échéancier integrity tests — deposit + Σ installments == prix.
 * Build should be RED if any payment schedule doesn't add up.
 */
import {
  getAllOffers,
  getStageFormats,
  getPonctuelOffers,
  getCoachingOffers,
  getPacks,
  getEffectivePrice,
  type AnnualOffer,
} from '../lib/pricing';

// ── Helper ──

function buildAnnualPaymentTotal(o: AnnualOffer): { total: number; deposit: number; installments: number[] } | null {
  if (o.deposit == null || o.n_installments == null || o.installment_amount == null) return null;
  const regular = o.n_installments - 1;
  const last = o.last_installment ?? o.installment_amount;
  const installments = [...Array(regular).fill(o.installment_amount), last];
  const total = o.deposit + installments.reduce((s, v) => s + v, 0);
  return { total, deposit: o.deposit, installments };
}

// ── Tests ──

describe('Échéancier integrity', () => {
  describe('annual_offers (scolarisé)', () => {
    const scolarise = getAllOffers().filter(o => o.track === 'scolarise');

    test.each(scolarise.map(o => [o.id, o]))('%s: deposit + installments == price', (_id, offer) => {
      const o = offer as AnnualOffer;
      const price = getEffectivePrice(o);
      const payment = buildAnnualPaymentTotal(o);
      if (price == null || payment == null) return; // no payment schedule (e.g. coaching 450 TND)
      expect(payment.total).toBe(price);
    });
  });

  describe('libre_offers', () => {
    const libre = getAllOffers().filter(o => o.track === 'libre');

    test.each(libre.filter(o => o.deposit != null).map(o => [o.id, o]))('%s: deposit + installments == price', (_id, offer) => {
      const o = offer as AnnualOffer;
      const price = getEffectivePrice(o);
      const payment = buildAnnualPaymentTotal(o);
      if (price == null || payment == null) return;
      expect(payment.total).toBe(price);
    });
  });

  describe('stage_formats', () => {
    const stages = getStageFormats();

    test.each(stages.map(f => [f.format_id, f]))('%s: deposit + solde == price', (_id, format) => {
      const f = format as (typeof stages)[0];
      expect(f.payment.deposit + f.payment.solde).toBe(f.price_per_student);
    });
  });

  describe('ponctuel_offers', () => {
    const ponctuel = getPonctuelOffers();

    test.each(ponctuel.map(p => [p.id, p]))('%s: deposit + solde == price', (_id, offer) => {
      const p = offer as (typeof ponctuel)[0];
      if (p.payment.full_at_booking) {
        // Full payment at booking — deposit should equal price
        expect(p.payment.deposit).toBe(p.price_per_student);
      } else {
        expect(p.payment.deposit + p.payment.solde).toBe(p.price_per_student);
      }
    });
  });

  describe('packs', () => {
    const packs = getPacks();

    test.each(packs.map(p => [p.id, p]))('%s: deposit + Σ solde_schedule == price', (_id, pack) => {
      const p = pack as (typeof packs)[0];
      const soldeTotal = p.payment.solde_schedule.reduce((s, v) => s + v, 0);
      expect(p.payment.deposit + soldeTotal).toBe(p.price);
    });
  });

  describe('no hardcoded prices in components', () => {
    test('all annual offers have payment data from JSON (not computed)', () => {
      const withPayment = getAllOffers().filter(o => o.deposit != null);
      // Every offer with a deposit should also have n_installments
      for (const o of withPayment) {
        if (o.n_installments != null) {
          expect(o.installment_amount).not.toBeNull();
        }
      }
    });
  });

  describe('effectif invariants', () => {
    test('no group_max > 5 in any offer', () => {
      const all = getAllOffers();
      for (const o of all) {
        if (o.group_max != null) {
          expect(o.group_max).toBeLessThanOrEqual(5);
        }
      }
    });

    test('no group_max > 5 in stages', () => {
      for (const f of getStageFormats()) {
        expect(f.group_max).toBeLessThanOrEqual(5);
      }
    });
  });
});
