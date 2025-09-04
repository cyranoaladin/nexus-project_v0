import { computeIndices } from '@/lib/scoring/pedago';
import { describe, expect, it } from '@jest/globals';

describe('computeIndices', () => {
  it('normalise et renvoie des IDX bornés', () => {
    const out = computeIndices({ B_AUTONOMIE: 4, B_ORGA: 8, B_MOTIV: 3, B_STRESS: 2, B_CONC: 3, B_MEMO: 2, B_ANALYSE: 3, B_DYS: 1 });
    expect(out.IDX_AUTONOMIE).toBeGreaterThanOrEqual(0);
    expect(out.IDX_ORGANISATION).toBeLessThanOrEqual(10);
    expect(out.IDX_SUSPECT_DYS).toBeLessThanOrEqual(4);
  });
});
