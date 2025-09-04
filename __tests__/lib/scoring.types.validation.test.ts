import { PedagoItemSchema, QcmItemSchema } from '@/lib/scoring/types';

describe('Types & validation (QCM/Pédago)', () => {
  it('valide un item QCM mcq', () => {
    const ok = QcmItemSchema.safeParse({
      id: 'M1', domain: 'algebre', type: 'mcq', difficulty: 'A', weight: 1,
      prompt_latex: 'x^2', choices: [{ k: 'A', latex: '1', correct: true }, { k: 'B', latex: '2' }]
    });
    expect(ok.success).toBe(true);
  });

  it('rejette un item QCM mal formé', () => {
    const bad = QcmItemSchema.safeParse({ id: 'X', type: 'mcq' });
    expect(bad.success).toBe(false);
  });

  it('valide un item pédago likert', () => {
    const ok = PedagoItemSchema.safeParse({ id: 'B1', type: 'likert', label: 'Motivation', mapsTo: 'IDX_MOTIVATION' });
    expect(ok.success).toBe(true);
  });
});
