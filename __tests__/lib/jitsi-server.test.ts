import { deterministicRoomSeedForSession } from '@/lib/jitsi-server';

describe('deterministicRoomSeedForSession', () => {
  const previousJitsiSecret = process.env.JITSI_ROOM_SECRET;

  afterEach(() => {
    if (previousJitsiSecret === undefined) delete process.env.JITSI_ROOM_SECRET;
    else process.env.JITSI_ROOM_SECRET = previousJitsiSecret;
  });

  it('is deterministic for the same sessionId', () => {
    const seed1 = deterministicRoomSeedForSession('session-1');
    const seed2 = deterministicRoomSeedForSession('session-1');
    expect(seed1).toBe(seed2);
  });

  it('differs for a different sessionId', () => {
    const seed1 = deterministicRoomSeedForSession('session-1');
    const seed2 = deterministicRoomSeedForSession('session-2');
    expect(seed1).not.toBe(seed2);
  });

  it('is not simply the base64/plain sessionId — it is not reconstructible without the server secret', () => {
    const seed = deterministicRoomSeedForSession('session-1');
    expect(seed).not.toContain('session-1');
    expect(Buffer.from(seed, 'hex').length).toBeGreaterThan(0);
  });

  it('throws a clear error when neither JITSI_ROOM_SECRET nor NEXTAUTH_SECRET is configured', () => {
    delete process.env.JITSI_ROOM_SECRET;
    const previousAuthSecret = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    try {
      expect(() => deterministicRoomSeedForSession('session-1')).toThrow(
        'JITSI_ROOM_SECRET_OR_NEXTAUTH_SECRET_REQUIRED'
      );
    } finally {
      if (previousAuthSecret !== undefined) process.env.NEXTAUTH_SECRET = previousAuthSecret;
    }
  });
});
