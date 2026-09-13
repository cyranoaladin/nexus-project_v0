import { resolveJitsiRoomNameForSession } from '@/lib/jitsi-server';

describe('resolveJitsiRoomNameForSession', () => {
  const previousJitsiSecret = process.env.JITSI_ROOM_SECRET;

  afterEach(() => {
    if (previousJitsiSecret === undefined) delete process.env.JITSI_ROOM_SECRET;
    else process.env.JITSI_ROOM_SECRET = previousJitsiSecret;
  });

  it('is deterministic for the same sessionId', () => {
    const name1 = resolveJitsiRoomNameForSession('session-1');
    const name2 = resolveJitsiRoomNameForSession('session-1');
    expect(name1).toBe(name2);
  });

  it('differs for a different sessionId', () => {
    const name1 = resolveJitsiRoomNameForSession('session-1');
    const name2 = resolveJitsiRoomNameForSession('session-2');
    expect(name1).not.toBe(name2);
  });

  it('never contains the raw or a meaningful prefix of the sessionId — not reconstructible without the server secret', () => {
    const sessionId = 'session-1234567890abcdef';
    const name = resolveJitsiRoomNameForSession(sessionId);
    expect(name).not.toContain(sessionId);
    // Only the HMAC digest portion is derived from sessionId; the
    // "nexus-session-" label is a fixed, non-identifying constant (and
    // happens to share plain-English characters with a typical sessionId
    // value like "session-...", which is irrelevant noise, not a leak).
    const digestPart = name.replace(/^nexus-session-/, '');
    for (let len = 4; len <= sessionId.length; len++) {
      expect(digestPart).not.toContain(sessionId.slice(0, len));
    }
  });

  it('is not a reversible encoding (e.g. base64) of the sessionId', () => {
    const sessionId = 'session-1';
    const name = resolveJitsiRoomNameForSession(sessionId);
    const suffix = name.replace(/^nexus-session-/, '');
    expect(() => Buffer.from(suffix, 'base64').toString('utf8')).not.toThrow();
    expect(Buffer.from(suffix, 'base64').toString('utf8')).not.toContain(sessionId);
  });

  it('throws a clear error when JITSI_ROOM_SECRET is not configured', () => {
    delete process.env.JITSI_ROOM_SECRET;
    expect(() => resolveJitsiRoomNameForSession('session-1')).toThrow('JITSI_ROOM_SECRET_INVALID');
  });

  it('throws when JITSI_ROOM_SECRET is shorter than 32 characters', () => {
    process.env.JITSI_ROOM_SECRET = 'too-short';
    expect(() => resolveJitsiRoomNameForSession('session-1')).toThrow('JITSI_ROOM_SECRET_INVALID');
  });

  it('does NOT fall back to NEXTAUTH_SECRET when JITSI_ROOM_SECRET is absent', () => {
    delete process.env.JITSI_ROOM_SECRET;
    const previousAuthSecret = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = 'a-perfectly-valid-nextauth-secret-32-chars';
    try {
      expect(() => resolveJitsiRoomNameForSession('session-1')).toThrow('JITSI_ROOM_SECRET_INVALID');
    } finally {
      if (previousAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
      else process.env.NEXTAUTH_SECRET = previousAuthSecret;
    }
  });
});
