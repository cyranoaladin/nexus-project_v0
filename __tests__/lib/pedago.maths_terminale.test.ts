import { buildPedagoPayloadMathsTerminale } from '@/lib/scoring/pedago_maths_terminale';

describe('pedago Maths Terminale', () => {
  it('construit un profil cohérent', () => {
    const survey = {
      questions: [
        { id: 'T1', type: 'likert', weight: 2 },
        { id: 'T2', type: 'likert', weight: 1 },
        { id: 'T12', type: 'likert', weight: 1 },
        { id: 'T13', type: 'likert', weight: 1 },
        { id: 'T14', type: 'likert', weight: 1 },
        { id: 'T9', type: 'likert', weight: 1 },
        { id: 'T10', type: 'likert', weight: 1 },
        { id: 'T17', type: 'likert', weight: 1, reverse: true },
        { id: 'T18', type: 'likert', weight: 1 },
        { id: 'T6', type: 'likert', weight: 1 },
        { id: 'T22', type: 'likert', weight: 1 },
      ]
    } as any;
    const answers = { T1: 5, T2: 4, T12: 5, T13: 3, T14: 2, T9: 4, T10: 4, T17: 2, T18: 4, T6: 4, T22: 4 };
    const out = buildPedagoPayloadMathsTerminale(survey as any, answers as any);
    expect(out.pedagoScores).toBeTruthy();
    expect(out.pedagoProfile.motivation).toBeDefined();
    expect(['Visuel', 'Auditif', 'Kinesthésique']).toContain(out.pedagoProfile.style);
    expect(out.pedagoProfile.organisation).toMatch(/bonne|moyenne/);
    expect(out.pedagoProfile.confidence).toBeDefined();
  });
});
