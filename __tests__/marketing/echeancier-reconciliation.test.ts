/**
 * Échéancier reconciliation cross-test
 *
 * Verifies that:
 *   1. Canonical payment data is arithmetically consistent (deposit + soldes = price)
 *   2. The banner resolver (BilanStrategiqueClient) and the modal (OfferDetailDialog)
 *      produce the SAME deposit, installment, and solde amounts for every offer.
 *
 * This is a TRUE inter-surface test: it imports the banner resolver and compares
 * its output against the canonical payment fields that the modal would render.
 */
import {
  getAllOffers,
  getStageFormats,
  getPonctuelOffers,
  getCoachingOffers,
  getPacks,
  getCarte,
  getRules,
  getEffectivePrice,
  getAnnualOfferPaymentSchedule,
} from '@/lib/pricing';

// Import the actual resolver used by the server-rendered bilan-gratuit banner
import { resolveSelectedOfferContext } from '@/app/bilan-gratuit/selected-offer';

describe('Échéancier reconciliation — canonical payment data', () => {
  const rules = getRules();

  // ── Part A: Arithmetic consistency (deposit + soldes = price) ──

  describe('Arithmetic: annual offers', () => {
    const offers = getAllOffers();

    it('has at least one annual offer', () => {
      expect(offers.length).toBeGreaterThan(0);
    });

    it.each(offers.map((o) => [o.id, o]))(
      '%s — deposit + installments = effective price',
      (_id, offer) => {
        const price = getEffectivePrice(offer);
        if (price == null) return;

        const schedule = getAnnualOfferPaymentSchedule(offer);
        if (!schedule) return;

        const { deposit, installments, lastInstallment } = schedule;
        expect(deposit).toBeGreaterThan(0);

        const regularSum = installments.slice(0, -1).reduce((sum, v) => sum + v, 0);
        const total = deposit + regularSum + lastInstallment;
        expect(Math.abs(total - price)).toBeLessThanOrEqual(rules.payment.rounding_tnd);
      }
    );
  });

  describe('Arithmetic: stage formats', () => {
    const formats = getStageFormats();

    it.each(formats.map((f) => [f.format_id, f]))(
      '%s — deposit + solde = price',
      (_id, format) => {
        const total = format.payment.deposit + format.payment.solde;
        expect(Math.abs(total - format.price_per_student)).toBeLessThanOrEqual(rules.payment.rounding_tnd);
      }
    );
  });

  describe('Arithmetic: ponctuel offers', () => {
    const offers = getPonctuelOffers();

    it.each(offers.map((o) => [o.id, o]))(
      '%s — payment sums to price',
      (_id, offer) => {
        if (offer.payment.full_at_booking) {
          expect(offer.payment.deposit).toBe(offer.price_per_student);
          return;
        }
        const total = offer.payment.deposit + (offer.payment.solde ?? 0);
        expect(Math.abs(total - offer.price_per_student)).toBeLessThanOrEqual(rules.payment.rounding_tnd);
      }
    );
  });

  describe('Arithmetic: coaching offers', () => {
    const offers = getCoachingOffers();

    it.each(offers.map((o) => [o.id, o]))(
      '%s — payment sums to price',
      (_id, offer) => {
        if (offer.payment.full_at_booking) {
          expect(offer.payment.deposit).toBe(offer.price);
          return;
        }
        let total = offer.payment.deposit;
        if (offer.payment.solde_schedule?.length) {
          total += offer.payment.solde_schedule.reduce((s, v) => s + v, 0);
        } else if (offer.payment.solde != null) {
          total += offer.payment.solde;
        }
        expect(Math.abs(total - offer.price)).toBeLessThanOrEqual(rules.payment.rounding_tnd);
      }
    );
  });

  describe('Arithmetic: packs', () => {
    const packs = getPacks();

    it.each(packs.map((p) => [p.id, p]))(
      '%s — deposit + solde_schedule = price',
      (_id, pack) => {
        const soldeSum = pack.payment.solde_schedule.reduce((s, v) => s + v, 0);
        const total = pack.payment.deposit + soldeSum;
        expect(Math.abs(total - pack.price)).toBeLessThanOrEqual(rules.payment.rounding_tnd);
      }
    );
  });

  describe('Arithmetic: 30% deposit rule', () => {
    it('deposit_pct in rules is 30', () => {
      expect(rules.payment.deposit_pct).toBe(30);
    });

    it('all annual offers with deposit match ~30% of price', () => {
      for (const offer of getAllOffers()) {
        const price = getEffectivePrice(offer);
        if (price == null || !offer.deposit) continue;
        const expected30pct = Math.round((price * 0.3) / rules.payment.rounding_tnd) * rules.payment.rounding_tnd;
        expect(Math.abs(offer.deposit - expected30pct)).toBeLessThanOrEqual(rules.payment.rounding_tnd);
      }
    });
  });

  // ── Part B: Inter-surface reconciliation ──
  // Verifies that resolveSelectedOfferContext (banner) returns the SAME
  // deposit, installments, solde, and solde_schedule as the canonical data
  // that OfferDetailDialog would render.

  describe('Inter-surface: banner resolver matches canonical for annual offers', () => {
    const offers = getAllOffers();

    it.each(offers.map((o) => [o.id, o]))(
      '%s — banner deposit + installments match canonical',
      (_id, offer) => {
        const price = getEffectivePrice(offer);
        if (price == null) return;

        const canonical = getAnnualOfferPaymentSchedule(offer);
        const banner = resolveSelectedOfferContext(offer.id);

        expect(banner).not.toBeNull();
        expect(banner!.price).toBe(price);
        expect(banner!.deposit).toBe(canonical?.deposit);

        // Banner must expose actual installment amounts, not just a count
        if (canonical?.installments) {
          expect(banner!.installments).toEqual(canonical.installments);
        }
      }
    );
  });

  describe('Inter-surface: banner resolver matches canonical for stage formats', () => {
    const formats = getStageFormats();

    it.each(formats.map((f) => [f.format_id, f]))(
      '%s — banner deposit + solde match canonical',
      (_id, format) => {
        const banner = resolveSelectedOfferContext(format.format_id);

        expect(banner).not.toBeNull();
        expect(banner!.price).toBe(format.price_per_student);
        expect(banner!.deposit).toBe(format.payment.deposit);
        expect(banner!.solde).toBe(format.payment.solde);
      }
    );
  });

  describe('Inter-surface: banner resolver matches canonical for ponctuel offers', () => {
    const offers = getPonctuelOffers();

    it.each(offers.map((o) => [o.id, o]))(
      '%s — banner matches canonical',
      (_id, offer) => {
        const banner = resolveSelectedOfferContext(offer.id);

        expect(banner).not.toBeNull();
        expect(banner!.price).toBe(offer.price_per_student);
        expect(banner!.deposit).toBe(offer.payment.deposit);

        if (offer.payment.full_at_booking) {
          expect(banner!.full_at_booking).toBe(true);
        } else {
          expect(banner!.solde).toBe(offer.payment.solde);
        }
      }
    );
  });

  describe('Inter-surface: banner resolver matches canonical for coaching offers', () => {
    const offers = getCoachingOffers();

    it.each(offers.map((o) => [o.id, o]))(
      '%s — banner matches canonical',
      (_id, offer) => {
        const banner = resolveSelectedOfferContext(offer.id);

        expect(banner).not.toBeNull();
        expect(banner!.price).toBe(offer.price);

        if (offer.payment.full_at_booking) {
          expect(banner!.full_at_booking).toBe(true);
          expect(banner!.deposit).toBe(offer.price);
        } else {
          expect(banner!.deposit).toBe(offer.payment.deposit);
          if (offer.payment.solde_schedule?.length) {
            expect(banner!.solde_schedule).toEqual(offer.payment.solde_schedule);
          } else if (offer.payment.solde != null) {
            expect(banner!.solde).toBe(offer.payment.solde);
          }
        }
      }
    );
  });

  describe('Inter-surface: banner resolver matches canonical for packs', () => {
    const packs = getPacks();

    it.each(packs.map((p) => [p.id, p]))(
      '%s — banner deposit + solde_schedule match canonical',
      (_id, pack) => {
        const banner = resolveSelectedOfferContext(pack.id);

        expect(banner).not.toBeNull();
        expect(banner!.price).toBe(pack.price);
        expect(banner!.deposit).toBe(pack.payment.deposit);
        expect(banner!.solde_schedule).toEqual(pack.payment.solde_schedule);
      }
    );
  });

  describe('Inter-surface: carte Nexus', () => {
    it('banner matches canonical', () => {
      const carte = getCarte();
      const banner = resolveSelectedOfferContext(carte.id);

      expect(banner).not.toBeNull();
      expect(banner!.price).toBe(carte.price_annual);
      expect(banner!.full_at_booking).toBe(true);
    });
  });
});
