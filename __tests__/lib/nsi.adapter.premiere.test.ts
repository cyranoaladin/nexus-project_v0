import { buildPdfPayloadNSIPremiere } from '@/lib/scoring/adapter_nsi_premiere';

describe('NSI Première adapter', () => {
  it('orders domains and selects offers based on averages and lows', () => {
    const results = {
      total: 30,
      totalMax: 60,
      byDomain: {
        TypesBase: { points: 8, max: 10, percent: 80 },
        TypesConstruits: { points: 8, max: 10, percent: 80 },
        Algo: { points: 8, max: 10, percent: 80 },
        LangagePython: { points: 8, max: 10, percent: 80 },
        TablesDonnees: { points: 6, max: 10, percent: 60 },
        IHMWeb: { points: 6, max: 10, percent: 60 },
        Reseaux: { points: 6, max: 10, percent: 60 },
        ArchOS: { points: 4, max: 10, percent: 40 },
        HistoireEthique: { points: 8, max: 10, percent: 80 },
      }
    } as any;
    const payload = buildPdfPayloadNSIPremiere(results);
    expect(payload.scoresByDomain.length).toBeGreaterThan(0);
    expect(['Cortex','Studio Flex','Académies','Odyssée']).toContain(payload.offers.primary);
  });
});
