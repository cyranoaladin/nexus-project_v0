import { synthesize, analyzePedago } from '@/lib/scoring/pedago';
import { scoreQCM } from '@/lib/scoring/qcm';

describe('Bilan synthesize decision matrix', () => {
  it('recommends Cortex for strong autonomous profile', () => {
    const domains = [
      { domain: 'Calcul littéral & équations' as any, percent: 80 },
      { domain: 'Fonctions & graphes' as any, percent: 78 },
    ];
    const pedago = analyzePedago({ motivation: 'bonne', expectations: ['defis'] });
    const res = synthesize(domains as any, pedago);
    expect(res.offers.primary).toBe('Cortex');
  });

  it('recommends Studio Flex for 1–2 weaknesses', () => {
    const domains = [
      { domain: 'Calcul littéral & équations' as any, percent: 48 },
      { domain: 'Fonctions & graphes' as any, percent: 65 },
    ];
    const pedago = analyzePedago({ motivation: 'bonne' });
    const res = synthesize(domains as any, pedago);
    expect(res.offers.primary).toBe('Studio Flex');
  });

  it('recommends Académies for multiple weaknesses', () => {
    const domains = [
      { domain: 'Calcul littéral & équations' as any, percent: 40 },
      { domain: 'Fonctions & graphes' as any, percent: 45 },
      { domain: 'Trigonométrie' as any, percent: 42 },
    ];
    const pedago = analyzePedago({});
    const res = synthesize(domains as any, pedago);
    expect(res.offers.primary).toBe('Académies');
  });

  it('recommends Odyssée for low autonomy/motivation', () => {
    const domains = [
      { domain: 'Calcul littéral & équations' as any, percent: 60 },
      { domain: 'Fonctions & graphes' as any, percent: 58 },
    ];
    const pedago = analyzePedago({ expectations: ['guidage'], motivation: 'faible' });
    const res = synthesize(domains as any, pedago);
    expect(res.offers.primary).toBe('Odyssée');
  });

  it('recommends Odyssée Candidat Libre for candidate status', () => {
    const domains = [
      { domain: 'Calcul littéral & équations' as any, percent: 70 },
      { domain: 'Fonctions & graphes' as any, percent: 72 },
    ];
    const pedago = analyzePedago({});
    const res = synthesize(domains as any, pedago, { statut: 'candidat_libre' });
    expect(res.offers.primary).toContain('Candidat Libre');
  });
});

describe('QCM scoring basics', () => {
  it('scores simple answers correctly', () => {
    const answers = { Q1: 'A', Q2: 'B', Q3: '3' } as any;
    const r = scoreQCM(answers);
    expect(r.total).toBeGreaterThan(0);
    expect(r.totalMax).toBeGreaterThan(0);
    expect(r.byDomain['Calcul littéral & équations'].percent).toBeGreaterThan(0);
  });
});

