import offersData from '@/content/pre-rentree-2026/offers.json';
import { getPreRentreeFoundationsProducts, getPreRentreePacks } from '@/lib/pricing';
import { PreRentreeOffersSchema } from './content-schema';
import type { LandingPack } from './configurator';
import type { EntryLevelCode } from './schema';

/**
 * The commercial reality of every (level, subject-count) a family can order,
 * priced from data/pricing.canonical.json through lib/pricing getters only.
 *
 * Two pricing models, one output shape — which is what lets a Fondations level
 * and a Premium level be rendered by the same component with no per-level
 * branch:
 *  - PER_SUBJECT (Fondations): n subjects cost n x the per-subject unit price
 *    and last n x 10 h. Never a flat or discounted rate.
 *  - PACK_BY_SUBJECT_COUNT (Premium): the canonical pack price for that exact
 *    count, which is not linear in the count.
 *
 * Lives in its own module (rather than getters.ts) because public-surface.ts
 * consumes it and getters.ts consumes public-surface.ts.
 */
export function getPreRentreeOfferOptions(): LandingPack[] {
  const offers = PreRentreeOffersSchema.parse(offersData);
  const options: LandingPack[] = [];
  for (const offer of offers.levels) {
    if (offer.pricing.model === 'PER_SUBJECT') {
      const [unit] = getPreRentreeFoundationsProducts(offer.pricing.productIds);
      if (!unit || unit.level !== offer.level) {
        throw new Error(`Missing Fondations pricing product for ${offer.level}`);
      }
      for (let count = 1; count <= offer.pricing.maximumSubjects; count += 1) {
        options.push({
          code: `PACK_${count}` as LandingPack['code'],
          level: offer.level,
          range: offer.range,
          subjectsCount: count,
          totalHours: unit.hours_per_subject * count,
          price: unit.price_per_student * count,
          deposit: unit.payment.deposit * count,
          balance: unit.payment.solde * count,
          pricePerHour: unit.price_per_student_hour,
          groupMinOpen: unit.group_min_open,
          groupMax: unit.group_max,
        });
      }
      continue;
    }
    for (const pack of getPreRentreePacks(offer.pricing.productIds)) {
      options.push({
        code: `PACK_${pack.subjects_count}` as LandingPack['code'],
        level: offer.level,
        range: offer.range,
        subjectsCount: pack.subjects_count,
        totalHours: pack.total_hours,
        price: pack.price_per_student,
        deposit: pack.payment.deposit,
        balance: pack.payment.solde,
        pricePerHour: pack.price_per_student_hour,
        groupMinOpen: pack.group_min_open,
        groupMax: pack.group_max,
      });
    }
  }
  return options;
}

export type PreRentreeLevelCapacity = {
  level: EntryLevelCode;
  range: 'FONDATIONS' | 'PREMIUM';
  minPerCohort: number;
  maxPerCohort: number;
  /** Commercial ceiling on how many subjects one pupil may combine. */
  maximumSubjects: number;
};

/**
 * Cohort size PER LEVEL, never per range. "Fondations : 3 à 6 élèves" became
 * false the day the 4e opened at 4, so no surface may derive an effectif from
 * the range — it reads the level's own capacity here.
 */
export function getPreRentreeLevelCapacities(): PreRentreeLevelCapacity[] {
  const offers = PreRentreeOffersSchema.parse(offersData);
  return offers.levels.map((offer) => ({
    level: offer.level,
    range: offer.range,
    minPerCohort: offer.capacity.min,
    maxPerCohort: offer.capacity.max,
    maximumSubjects: offer.pricing.maximumSubjects,
  }));
}
