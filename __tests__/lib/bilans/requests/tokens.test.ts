import {
  BILAN_FLOW_COOKIE_NAME,
  BILAN_FLOW_SESSION_TTL_SECONDS,
  createBilanFlowSessionToken,
  createBilanMagicLinkToken,
  hashBilanToken,
  isBilanTokenHashEqual,
  isValidBilanFlowSession,
  isValidBilanMagicLink,
} from '@/lib/bilans/requests/tokens';

describe('bilan request tokens', () => {
  const now = new Date('2026-07-29T10:00:00.000Z');

  it('generates an opaque 256-bit flow token and stores only its SHA-256 hash', () => {
    const token = createBilanFlowSessionToken({ now, production: false });

    expect(Buffer.from(token.rawToken, 'base64url')).toHaveLength(32);
    expect(token.rawToken).not.toContain('request');
    expect(token.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(token.tokenHash).toBe(hashBilanToken(token.rawToken));
    expect(token.tokenHash).not.toBe(token.rawToken);
  });

  it('uses a constant path-scoped and environment-aware cookie contract', () => {
    const development = createBilanFlowSessionToken({ now, production: false });
    const production = createBilanFlowSessionToken({ now, production: true });

    expect(development.cookie).toEqual({
      name: BILAN_FLOW_COOKIE_NAME,
      value: development.rawToken,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/bilan-gratuit',
        maxAge: BILAN_FLOW_SESSION_TTL_SECONDS,
      },
    });
    expect(production.cookie.options.secure).toBe(true);
    expect(production.cookie.options).not.toHaveProperty('domain');
    expect(development.expiresAt.getTime() - now.getTime()).toBe(
      BILAN_FLOW_SESSION_TTL_SECONDS * 1_000,
    );
  });

  it('compares token hashes deterministically without accepting malformed hashes', () => {
    const hash = hashBilanToken('opaque-token');

    expect(hashBilanToken('opaque-token')).toBe(hash);
    expect(isBilanTokenHashEqual(hash, hash)).toBe(true);
    expect(isBilanTokenHashEqual(hash, hashBilanToken('another-token'))).toBe(false);
    expect(isBilanTokenHashEqual(hash, 'not-a-sha-256-hash')).toBe(false);
  });

  it('accepts only the expected live request-scoped flow session', () => {
    const token = createBilanFlowSessionToken({ now, production: false });
    const record = {
      requestId: 'request_1',
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: null,
    };

    expect(isValidBilanFlowSession(record, {
      rawToken: token.rawToken,
      requestId: 'request_1',
      now,
    })).toBe(true);
    expect(isValidBilanFlowSession(record, {
      rawToken: token.rawToken,
      requestId: 'request_2',
      now,
    })).toBe(false);
    expect(isValidBilanFlowSession(
      { ...record, expiresAt: now },
      { rawToken: token.rawToken, requestId: 'request_1', now },
    )).toBe(false);
    expect(isValidBilanFlowSession(
      { ...record, revokedAt: now },
      { rawToken: token.rawToken, requestId: 'request_1', now },
    )).toBe(false);
  });

  it('creates magic-link primitives and rejects replay, revocation, expiry and wrong scope', () => {
    const token = createBilanMagicLinkToken({ now });
    const record = {
      requestId: 'request_1',
      parentUserId: 'parent_1',
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: null,
      consumedAt: null,
    };
    const expected = {
      rawToken: token.rawToken,
      requestId: 'request_1',
      parentUserId: 'parent_1',
      now,
    };

    expect(Buffer.from(token.rawToken, 'base64url')).toHaveLength(32);
    expect(isValidBilanMagicLink(record, expected)).toBe(true);
    expect(isValidBilanMagicLink({ ...record, consumedAt: now }, expected)).toBe(false);
    expect(isValidBilanMagicLink({ ...record, revokedAt: now }, expected)).toBe(false);
    expect(isValidBilanMagicLink({ ...record, expiresAt: now }, expected)).toBe(false);
    expect(isValidBilanMagicLink(record, { ...expected, requestId: 'request_2' })).toBe(false);
    expect(isValidBilanMagicLink(record, { ...expected, parentUserId: 'parent_2' })).toBe(false);
  });
});
