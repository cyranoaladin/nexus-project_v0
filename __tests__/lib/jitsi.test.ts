import {
  buildJitsiUrlWithConfig,
  createJitsiRoomInfo,
  generateDeterministicJitsiUrl,
  generateDeterministicRoomName,
  generateJitsiRoomUrl,
  isValidJitsiUrl,
  parseJitsiUrl,
} from '@/lib/jitsi';

describe('jitsi utils', () => {
  const originalEnv = process.env;
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'uuid-test' },
      configurable: true,
    });
    if (!(globalThis as any).btoa) {
      (globalThis as any).btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
    }
  });

  afterAll(() => {
    process.env = originalEnv;
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
  });

  it('generates random room URL', () => {
    process.env.NEXT_PUBLIC_JITSI_SERVER_URL = 'https://jitsi.test';
    const url = generateJitsiRoomUrl('session-1', 'coach');
    expect(url).toContain('https://jitsi.test/nexus-reussite-session-session-1-uuid-test');
  });

  it('generates deterministic room name and URL', () => {
    process.env.NEXT_PUBLIC_JITSI_SERVER_URL = 'https://jitsi.test';
    const name = generateDeterministicRoomName('session-12345678', 'seed');
    const url = generateDeterministicJitsiUrl('session-12345678', 'seed');
    expect(url).toBe(`https://jitsi.test/${name}`);
  });

  it('parses and validates Jitsi URL', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const parsed = parseJitsiUrl('https://meet.jit.si/room-123');
    expect(parsed?.server).toBe('https://meet.jit.si');
    expect(parsed?.roomName).toBe('room-123');
    expect(isValidJitsiUrl('https://meet.jit.si/room-123')).toBe(true);
    expect(isValidJitsiUrl('not-a-url')).toBe(false);
    errorSpy.mockRestore();
  });

  it('builds URL with config params', () => {
    const url = buildJitsiUrlWithConfig('https://meet.jit.si/room-123', 'Alice', false);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('userInfo.displayName')).toBe('Alice');
    expect(parsed.searchParams.get('config.prejoinPageEnabled')).toBe('false');
    expect(parsed.searchParams.get('config.disableModeratorIndicator')).toBe('true');
  });

  it('creates room info object', () => {
    const info = createJitsiRoomInfo('session-abcdef12', 'Bob', true);
    expect(info.roomName).toContain('nexus-reussite-session');
    expect(info.fullUrl).toContain(info.roomName);
    expect(info.isHost).toBe(true);
  });
});
