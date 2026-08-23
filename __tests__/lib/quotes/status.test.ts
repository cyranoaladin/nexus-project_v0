import { canTransition, allowedNextStatuses, isTerminalStatus, requiresRevisionOnEdit } from '@/lib/quotes/status';

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
    expect(allowedNextStatuses('ACCEPTE')).toEqual(['INSCRIT']);
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

describe('requiresRevisionOnEdit — a sent quote is never mutated in place (CDC §46)', () => {
  test('ESTIMATION/BILAN_A_FAIRE/BILAN_TERMINE can still be edited in place', () => {
    expect(requiresRevisionOnEdit('ESTIMATION')).toBe(false);
    expect(requiresRevisionOnEdit('BILAN_A_FAIRE')).toBe(false);
    expect(requiresRevisionOnEdit('BILAN_TERMINE')).toBe(false);
  });

  test('DEVIS_ENVOYE and everything after requires a new revision', () => {
    expect(requiresRevisionOnEdit('DEVIS_ENVOYE')).toBe(true);
    expect(requiresRevisionOnEdit('DEVIS_CONSULTE')).toBe(true);
    expect(requiresRevisionOnEdit('A_RAPPELER')).toBe(true);
    expect(requiresRevisionOnEdit('ACCEPTE')).toBe(true);
  });
});
