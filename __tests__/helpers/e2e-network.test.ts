import { isIgnoredFailedResponseUrl } from '@/e2e/helpers/network';

describe('E2E failed-response allowlist', () => {
  it('accepts the exact HTTPS Google Tag Manager hosts', () => {
    expect(isIgnoredFailedResponseUrl('https://www.googletagmanager.com/gtag/js?id=G-TEST')).toBe(true);
    expect(isIgnoredFailedResponseUrl('https://googletagmanager.com/gtag/js?id=G-TEST')).toBe(true);
  });

  it('rejects deceptive hosts and query-string mentions', () => {
    expect(isIgnoredFailedResponseUrl('https://googletagmanager.com.evil.test/payload')).toBe(false);
    expect(isIgnoredFailedResponseUrl('https://evil.test/?next=googletagmanager.com')).toBe(false);
    expect(isIgnoredFailedResponseUrl('http://www.googletagmanager.com/gtag/js')).toBe(false);
    expect(isIgnoredFailedResponseUrl('https://www.googletagmanager.com:444/gtag/js')).toBe(false);
  });

  it('accepts framework assets only on the application origin', () => {
    const applicationUrl = 'https://nexusreussite.academy/offres';

    expect(
      isIgnoredFailedResponseUrl('https://nexusreussite.academy/_next/static/chunk.js', applicationUrl),
    ).toBe(true);
    expect(isIgnoredFailedResponseUrl('https://evil.test/_next/static/chunk.js', applicationUrl)).toBe(false);
    expect(isIgnoredFailedResponseUrl('not a URL', applicationUrl)).toBe(false);
  });
});
