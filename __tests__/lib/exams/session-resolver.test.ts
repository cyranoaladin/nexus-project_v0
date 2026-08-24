import { getExamPolicy, requireExamPolicy, getSupportedSessions, getSessionStatus, assertSessionSellable } from '@/lib/exams/catalog';

describe('T-resolver — résolution multi-session', () => {
  test('getSupportedSessions inclut 2026, 2027 et 2028', () => {
    expect(getSupportedSessions()).toEqual([2026, 2027, 2028]);
  });

  test('session 2026: statut HISTORICAL_READONLY, Grand Oral coef 10 (pré-EAM)', () => {
    expect(getSessionStatus(2026)).toBe('HISTORICAL_READONLY');
    const policy = requireExamPolicy(2026);
    const grandOral = policy.epreuves.find((e) => e.id === 'grand-oral');
    expect(grandOral?.coefficient).toBe(10);
    expect(policy.epreuves.some((e) => e.id === 'eam')).toBe(false);
  });

  test('session 2027: statut ACTIVE, vendable', () => {
    expect(getSessionStatus(2027)).toBe('ACTIVE');
    expect(() => assertSessionSellable(2027)).not.toThrow();
  });

  test('session 2026: vente bloquée (fail closed)', () => {
    expect(() => assertSessionSellable(2026)).toThrow(/HISTORICAL_READONLY/);
  });

  test('session 2028: statut SKELETON_UNCONFIRMED, vente bloquée, aucune valeur inventée', () => {
    expect(getSessionStatus(2028)).toBe('SKELETON_UNCONFIRMED');
    expect(() => assertSessionSellable(2028)).toThrow(/SKELETON_UNCONFIRMED/);
    const policy = requireExamPolicy(2028);
    expect(policy.epreuves).toEqual([]);
  });

  test('session inconnue: getExamPolicy retourne null (comportement fail-closed préexistant, non régressé)', () => {
    expect(getExamPolicy(2099)).toBeNull();
  });
});
