import { scorePedagoNSI, deriveProfileNSI, recommendModalityNSI } from '@/lib/scoring/adapter_nsi_pedago';

describe('NSI Pedago adapter', () => {
  it('scores likert with reverse and computes percents', () => {
    const survey = { meta: {}, questions: [
      { id: 'P1', domain: 'Motivation', type: 'likert', weight: 2 },
      { id: 'P2', domain: 'Motivation', type: 'likert', weight: 2, reverse: true },
    ] } as any;
    const answers = { P1: 5, P2: 1 } as any; // reverse on P2 -> becomes 5
    const res = scorePedagoNSI(survey, answers);
    expect(res.byDomain.Motivation.percent).toBeGreaterThanOrEqual(90);
  });

  it('derives VAK and autonomy/organisation/stress flags', () => {
    const survey = { meta: {}, questions: [] } as any;
    const answers = { P11: 5, P12: 2, P13: 3, P4: 5, P5: 4, P6: 4, P7: 1, P8: 4, P9: 4, P10: 4, P26: 4, P16: 1, P17: 5 } as any;
    const scores = scorePedagoNSI(survey, answers);
    const profile = deriveProfileNSI(scores);
    expect(profile.vak).toBe('Visuel');
    expect(profile.autonomie).toBe('bonne');
    expect(profile.organisation).toBe('bonne');
    expect(profile.stress).toBe('faible');
  });

  it('recommends individual modality when stress is high or flags present', () => {
    const survey = { meta: {}, questions: [] } as any;
    const answers = { P16: 5, P17: 1, P30: [1] } as any; // stress élevé + TDAH_suspect
    const scores = scorePedagoNSI(survey, answers);
    const profile = deriveProfileNSI(scores);
    const mod = recommendModalityNSI(profile);
    expect(mod.format).toContain('individuel');
  });
});
