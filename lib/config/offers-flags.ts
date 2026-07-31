/**
 * Feature flag controlling visibility of the 100%-online offers on the
 * public /offres surface. They remain in pricing.canonical.json (valid
 * catalogue entries, usable via direct id) — this flag only hides them
 * from the public marketing page's rendered sections.
 */
export const ONLINE_OFFERS_ENABLED = false;

/** Offer ids hidden from /offres while ONLINE_OFFERS_ENABLED is false. */
export const ONLINE_OFFER_IDS: readonly string[] = [
  'term-libre-online',
  '1re-libre-essentiel',
  'plateforme-accomp',
];

/** Filters a list of catalogue offers down to the public surface. */
export function publicOffers<T extends { id: string }>(offers: readonly T[]): T[] {
  if (ONLINE_OFFERS_ENABLED) return [...offers];
  return offers.filter((o) => !ONLINE_OFFER_IDS.includes(o.id));
}
