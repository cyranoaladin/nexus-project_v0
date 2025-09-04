import { decideOffers } from '@/lib/scoring/offers_decision';

describe('offers decision', () => {
  it('choisit Cortex quand tout est haut et homogène', () => {
    const s: any = { byDomain: { A: { percent: 90 }, B: { percent: 88 }, C: { percent: 92 } } };
    const d = decideOffers(s);
    expect(d.primary).toBe('Cortex');
  });
  it('choisit Académies sur profils faibles', () => {
    const s: any = { byDomain: { A: { percent: 40 }, B: { percent: 48 }, C: { percent: 35 }, D: { percent: 60 } } };
    const d = decideOffers(s);
    expect(d.primary).toBe('Académies');
  });
});
