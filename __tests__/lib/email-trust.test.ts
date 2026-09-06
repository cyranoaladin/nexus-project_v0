import { hasTrustedAccountEmail } from '@/lib/auth/email-trust';
it('preserves historical email accounts with explicitly empty phone history', () => {
  expect(hasTrustedAccountEmail({ parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] })).toBe(true);
});
it('requires explicit proof metadata instead of treating omitted history as empty', () => {
  expect(hasTrustedAccountEmail({ parentPhoneState: 'NONE' })).toBe(false);
  expect(hasTrustedAccountEmail(null)).toBe(false);
});
it('accepts independently verified email after phone enrollment', () => {
  expect(hasTrustedAccountEmail({ parentPhoneState: 'NONE', emailVerifiedAt: new Date(), parentPhoneChallenges: [{ id: 'revoked' }] })).toBe(true);
});
