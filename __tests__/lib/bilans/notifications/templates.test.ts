import {
  buildBilanMagicLinkEmail,
  resolveBilanPublicOrigin,
} from '@/lib/bilans/notifications/templates';

const RAW_TOKEN = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';

describe('bilan notification templates', () => {
  it('builds a fragment-only continuation URL with escaped presentation data', () => {
    const email = buildBilanMagicLinkEmail({
      publicOrigin: 'https://nexusreussite.academy',
      rawToken: RAW_TOKEN,
      parentFirstName: '<img src=x onerror=alert(1)>',
    });

    expect(email.url).toBe(
      `https://nexusreussite.academy/auth/bilan-magic#token=${RAW_TOKEN}`,
    );
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).not.toContain('?token=');
    expect(email.text).not.toContain('requestId');
    expect(email.subject).not.toContain(RAW_TOKEN);
  });

  it('accepts only a clean HTTPS server origin in production', () => {
    expect(resolveBilanPublicOrigin({
      nodeEnv: 'production',
      nextAuthUrl: 'https://nexusreussite.academy',
    })).toBe('https://nexusreussite.academy');

    expect(() => resolveBilanPublicOrigin({
      nodeEnv: 'production',
      nextAuthUrl: 'http://nexusreussite.academy',
    })).toThrow('Invalid bilan public origin');
    expect(() => resolveBilanPublicOrigin({
      nodeEnv: 'production',
      nextAuthUrl: 'https://user:secret@nexusreussite.academy/path?leak=yes',
    })).toThrow('Invalid bilan public origin');
  });

  it('allows explicit local HTTP origins only outside production', () => {
    expect(resolveBilanPublicOrigin({
      nodeEnv: 'test',
      nextAuthUrl: 'http://127.0.0.1:3000',
    })).toBe('http://127.0.0.1:3000');
    expect(() => resolveBilanPublicOrigin({
      nodeEnv: 'test',
      nextAuthUrl: 'http://example.com',
    })).toThrow('Invalid bilan public origin');
  });
});
