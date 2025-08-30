// __tests__/lib/bilan/offers.test.ts
import { recommendOffers } from '@/lib/bilan/offers';

describe('recommendOffers', () => {
  const baseScores = {
    byDomain: {},
    scoreGlobal: 0,
    weakDomains: 0,
  } as any;

  it('candidat libre -> Odyssée CL', () => {
    const r = recommendOffers({ ...baseScores, scoreGlobal: 80 }, {}, 'candidat_libre');
    expect(r.primary).toMatch(/Odyssée Candidat Libre/i);
  });

  it('≥70 and weak<=1 -> Cortex', () => {
    const r = recommendOffers({ ...baseScores, scoreGlobal: 75, weakDomains: 1 }, { motivation: 'bonne', organisation: 'régulière' }, 'scolarise_fr');
    expect(r.primary).toBe('Cortex');
  });

  it('55–70 with <=2 weak -> Flex', () => {
    const r = recommendOffers({ ...baseScores, scoreGlobal: 60, weakDomains: 2 }, { motivation: 'bonne' }, 'scolarise_fr');
    expect(r.primary).toBe('Studio Flex');
  });

  it('40–65 with >=2 weak -> Académies', () => {
    const r = recommendOffers({ ...baseScores, scoreGlobal: 50, weakDomains: 3 }, {}, 'scolarise_fr');
    expect(r.primary).toBe('Académies');
  });

  it('<55 or low motivation/organisation -> Odyssée', () => {
    const r = recommendOffers({ ...baseScores, scoreGlobal: 45, weakDomains: 1 }, { motivation: 'faible' }, 'scolarise_fr');
    expect(r.primary).toBe('Odyssée');
  });
});

