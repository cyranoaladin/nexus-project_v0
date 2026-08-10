import { hasUserEmail, normalizeUserEmail, requireUserEmail } from '@/lib/contact/user-email';

describe('coordonnée e-mail utilisateur nullable', () => {
  it('rétrécit une adresse présente et normalisée', () => {
    expect(hasUserEmail(' parent@example.test ')).toBe(true);
    expect(requireUserEmail(' parent@example.test ')).toBe('parent@example.test');
  });

  it('normalise espaces, casse et représentation Unicode par un seul contrat', () => {
    expect(normalizeUserEmail('  E\u0301LEVE@EXAMPLE.TEST  ')).toBe('éleve@example.test');
    expect(requireUserEmail('  E\u0301LEVE@EXAMPLE.TEST  ')).toBe('éleve@example.test');
  });

  it.each([null, undefined, '', '   '])('refuse la coordonnée absente %j', (email) => {
    expect(hasUserEmail(email)).toBe(false);
    expect(() => requireUserEmail(email)).toThrow('USER_EMAIL_REQUIRED');
  });
});
