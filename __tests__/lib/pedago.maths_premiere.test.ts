import { buildPedagoPayloadMathsPremiere } from '@/lib/scoring/pedago_maths_premiere';

describe('pedago Maths Première', () => {
  it('dérive un profil cohérent', () => {
    const survey = {
      questions: [
        { id: 'M1', type: 'likert', weight: 2 },
        { id: 'M12', type: 'likert', weight: 2 },
        { id: 'M13', type: 'likert', weight: 2 },
        { id: 'M14', type: 'likert', weight: 2 },
        { id: 'M9', type: 'likert', weight: 2 },
        { id: 'M10', type: 'likert', weight: 2 },
        { id: 'M17', type: 'likert', weight: 2, reverse: true },
        { id: 'M18', type: 'likert', weight: 2 },
        { id: 'M6', type: 'likert', weight: 2 },
        { id: 'M22', type: 'likert', weight: 2 },
      ]
    } as any;
    const answers = { M1: 5, M12: 5, M13: 3, M14: 2, M9: 4, M10: 4, M17: 2, M18: 5, M6: 4, M22: 4 };
    const out = buildPedagoPayloadMathsPremiere(survey as any, answers);
    expect(out.pedagoProfile.motivation).toBeDefined();
    expect(['Visuel', 'Auditif', 'Kinesthésique']).toContain(out.pedagoProfile.style);
    expect(['bonne', 'moyenne', 'fragile', 'correcte']).toContain(out.pedagoProfile.confidence);
  });
});
