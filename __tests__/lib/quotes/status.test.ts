import { canTransition, isTerminalStatus } from '@/lib/quotes/status';

describe('canTransition — server-controlled transitions only (CDC §25)', () => {
  test('ESTIMATION can move forward to BILAN_A_FAIRE, BILAN_TERMINE, DEVIS_ENVOYE, or EXPIRE', () => {
    expect(canTransition('ESTIMATION', 'BILAN_A_FAIRE')).toBe(true);
    expect(canTransition('ESTIMATION', 'DEVIS_ENVOYE')).toBe(true);
    expect(canTransition('ESTIMATION', 'EXPIRE')).toBe(true);
  });

  test('no status can transition to itself', () => {
    expect(canTransition('DEVIS_ENVOYE', 'DEVIS_ENVOYE')).toBe(false);
  });

  test('cannot skip backwards from ACCEPTE to DEVIS_ENVOYE', () => {
    expect(canTransition('ACCEPTE', 'DEVIS_ENVOYE')).toBe(false);
  });

  test('ACCEPTE can only move to INSCRIT', () => {
    expect(canTransition('ACCEPTE', 'INSCRIT')).toBe(true);
    expect(canTransition('ACCEPTE', 'REFUSE')).toBe(false);
  });

  test('REFUSE, INSCRIT, EXPIRE are terminal', () => {
    expect(isTerminalStatus('REFUSE')).toBe(true);
    expect(isTerminalStatus('INSCRIT')).toBe(true);
    expect(isTerminalStatus('EXPIRE')).toBe(true);
    expect(isTerminalStatus('ESTIMATION')).toBe(false);
  });

  test('cannot transition out of a terminal status', () => {
    expect(canTransition('INSCRIT', 'ACCEPTE')).toBe(false);
    expect(canTransition('REFUSE', 'ESTIMATION')).toBe(false);
  });
});
