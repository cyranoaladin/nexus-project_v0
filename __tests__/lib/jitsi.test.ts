import { getJitsiDomain, getJitsiServerUrl } from '@/lib/jitsi';

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

  it('falls back to the public Jitsi instance when unset', () => {
    delete process.env.NEXT_PUBLIC_JITSI_SERVER_URL;
    expect(getJitsiServerUrl()).toBe('https://meet.jit.si');
  });

  it('strips the protocol and trailing slash for the bare domain', () => {
    process.env.NEXT_PUBLIC_JITSI_SERVER_URL = 'https://visio.example.com/';
    expect(getJitsiDomain()).toBe('visio.example.com');
  });
});
