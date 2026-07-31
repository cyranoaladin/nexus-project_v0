import { ONLINE_OFFERS_ENABLED, ONLINE_OFFER_IDS, publicOffers } from '@/lib/config/offers-flags';
import { getFullPricingData } from '@/lib/pricing';

describe('offers-flags — public surface hides 100%-online offers', () => {
  it('ONLINE_OFFERS_ENABLED is false by default', () => {
    expect(ONLINE_OFFERS_ENABLED).toBe(false);
  });

  it('names exactly the 3 online offers to hide', () => {
    expect([...ONLINE_OFFER_IDS].sort()).toEqual(
      ['1re-libre-essentiel', 'plateforme-accomp', 'term-libre-online'].sort(),
    );
  });

  it('every flagged id still exists in the canonical catalogue (not a dangling reference)', () => {
    const data = getFullPricingData();
    const allIds = new Set(data.offers.map((o) => o.id));
    for (const id of ONLINE_OFFER_IDS) {
      expect(allIds.has(id)).toBe(true);
    }
  });

  it('publicOffers filters out the flagged ids while ONLINE_OFFERS_ENABLED is false', () => {
    const sample = [
      { id: 'term-libre-mixte' },
      { id: 'term-libre-online' },
      { id: '1re-libre-essentiel' },
      { id: '1re-libre-accomp' },
      { id: 'plateforme-accomp' },
    ];
    const visible = publicOffers(sample).map((o) => o.id);
    expect(visible).toEqual(['term-libre-mixte', '1re-libre-accomp']);
  });

  it('publicOffers is a no-op on an empty list', () => {
    expect(publicOffers([])).toEqual([]);
  });
});
