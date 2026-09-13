import { getJitsiDomain, getJitsiServerUrl } from '@/lib/jitsi';

function setNodeEnv(val: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = val;
}

describe('jitsi utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reads the server URL from NEXT_PUBLIC_JITSI_SERVER_URL', () => {
    process.env.NEXT_PUBLIC_JITSI_SERVER_URL = 'https://jitsi.test';
    expect(getJitsiServerUrl()).toBe('https://jitsi.test');
  });

  it('falls back to the dev/test fixture when unset outside production', () => {
    delete process.env.NEXT_PUBLIC_JITSI_SERVER_URL;
    setNodeEnv('test');
    expect(getJitsiServerUrl()).toBe('https://meet.jit.si');
  });

  it('fails closed (throws) when unset in production instead of falling back to the public server', () => {
    delete process.env.NEXT_PUBLIC_JITSI_SERVER_URL;
    setNodeEnv('production');
    expect(() => getJitsiServerUrl()).toThrow(/NEXT_PUBLIC_JITSI_SERVER_URL is not configured/);
  });

  it('uses the configured URL in production, never the public fallback', () => {
    process.env.NEXT_PUBLIC_JITSI_SERVER_URL = 'https://jitsi.prod.example.com';
    setNodeEnv('production');
    expect(getJitsiServerUrl()).toBe('https://jitsi.prod.example.com');
  });

  it('strips the protocol and trailing slash for the bare domain', () => {
    process.env.NEXT_PUBLIC_JITSI_SERVER_URL = 'https://visio.example.com/';
    expect(getJitsiDomain()).toBe('visio.example.com');
  });
});
