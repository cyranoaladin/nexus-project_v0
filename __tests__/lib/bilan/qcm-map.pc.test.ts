import { resolveQcmPath } from '@/lib/bilan/qcm-map';
import { describe, expect, it } from '@jest/globals';

describe('resolveQcmPath Physique-Chimie', () => {
  it('premiere -> qcm_seconde_for_premiere_pc.json', () => {
    const p = resolveQcmPath('PHYSIQUE_CHIMIE', 'premiere');
    expect(p.endsWith('/data/qcm_seconde_for_premiere_pc.json')).toBe(true);
  });
  it('terminale -> qcm_premiere_for_terminale_pc.json', () => {
    const p = resolveQcmPath('PHYSIQUE_CHIMIE', 'terminale');
    expect(p.endsWith('/data/qcm_premiere_for_terminale_pc.json')).toBe(true);
  });
});
