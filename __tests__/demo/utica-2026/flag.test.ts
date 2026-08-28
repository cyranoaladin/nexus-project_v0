/**
 * Kill switch du démonstrateur UTICA 2026 — amendement A2.
 * Désactivé par défaut ; activable uniquement via UTICA_DEMO_ENABLED=true.
 */
describe('isUticaDemoEnabled', () => {
  const ORIGINAL_ENV = process.env.UTICA_DEMO_ENABLED;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.UTICA_DEMO_ENABLED;
    else process.env.UTICA_DEMO_ENABLED = ORIGINAL_ENV;
    jest.resetModules();
  });

  test('désactivé par défaut (variable absente)', () => {
    delete process.env.UTICA_DEMO_ENABLED;
    jest.resetModules();
    const { isUticaDemoEnabled } = require('@/lib/demo/utica-2026/flag');
    expect(isUticaDemoEnabled()).toBe(false);
  });

  test('désactivé pour toute valeur autre que la chaîne "true"', () => {
    process.env.UTICA_DEMO_ENABLED = '1';
    jest.resetModules();
    const { isUticaDemoEnabled } = require('@/lib/demo/utica-2026/flag');
    expect(isUticaDemoEnabled()).toBe(false);
  });

  test('activé explicitement quand UTICA_DEMO_ENABLED=true', () => {
    process.env.UTICA_DEMO_ENABLED = 'true';
    jest.resetModules();
    const { isUticaDemoEnabled } = require('@/lib/demo/utica-2026/flag');
    expect(isUticaDemoEnabled()).toBe(true);
  });
});
