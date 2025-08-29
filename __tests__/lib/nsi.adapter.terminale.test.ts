import { buildPdfPayloadNSITerminale } from '@/lib/scoring/adapter_nsi_terminale';

describe('NSI Terminale adapter', () => {
  it('computes summary and offers for terminale', () => {
    const results = {
      total: 28,
      totalMax: 60,
      byDomain: {
        TypesBase: { points: 8, max: 10, percent: 80 },
        TypesConstruits: { points: 3, max: 10, percent: 30 },
        Algo: { points: 4, max: 10, percent: 40 },
        LangagePython: { points: 4, max: 10, percent: 40 },
        TablesDonnees: { points: 3, max: 10, percent: 30 },
        IHMWeb: { points: 3, max: 10, percent: 30 },
        Reseaux: { points: 3, max: 10, percent: 30 },
        ArchOS: { points: 0, max: 10, percent: 0 },
        HistoireEthique: { points: 0, max: 10, percent: 0 },
      }
    } as any;
    const payload = buildPdfPayloadNSITerminale(results);
    expect(payload.scoresByDomain.length).toBeGreaterThan(0);
    expect(['Cortex','Studio Flex','Académies','Odyssée']).toContain(payload.offers.primary);
  });
});
