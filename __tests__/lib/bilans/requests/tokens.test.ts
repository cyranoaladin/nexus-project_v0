import { createHash } from 'crypto';

import {
  BILAN_FLOW_COOKIE_NAME,
  BILAN_FLOW_SESSION_TTL_SECONDS,
  consumeBilanMagicLinkAtomically,
  createBilanFlowSessionToken,
  createBilanMagicLinkToken,
  hashBilanToken,
  isBilanTokenHashEqual,
  isEligibleBilanMagicLink,
  isValidBilanFlowSession,
  type BilanMagicLinkConsumptionRepository,
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
    const token = createBilanFlowSessionToken({ now, production: false });
    const anotherToken = createBilanFlowSessionToken({ now, production: false });
    const hash = hashBilanToken(token.rawToken);

    expect(hashBilanToken(token.rawToken)).toBe(hash);
    expect(isBilanTokenHashEqual(hash, hash)).toBe(true);
    expect(isBilanTokenHashEqual(hash, hashBilanToken(anotherToken.rawToken))).toBe(false);
    expect(isBilanTokenHashEqual(hash, 'not-a-sha-256-hash')).toBe(false);
  });

  it.each([
    '',
    'a'.repeat(42),
    'a'.repeat(44),
    'a'.repeat(43) + '=',
    'a'.repeat(10_000),
    'a'.repeat(42) + '+',
  ])('rejects non-canonical raw token %s', (rawToken) => {
    expect(() => hashBilanToken(rawToken)).toThrow('Invalid bilan token');

    const invalidHash = createHash('sha256').update(rawToken).digest('hex');
    expect(isValidBilanFlowSession({
      requestId: 'request_1',
      tokenHash: invalidHash,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
    }, {
      rawToken,
      requestId: 'request_1',
      now,
    })).toBe(false);
  });

  it('rejects invalid creation and validation dates', () => {
    const invalidDate = new Date(Number.NaN);
    expect(() => createBilanFlowSessionToken({
      now: invalidDate,
      production: false,
    })).toThrow('Invalid date');
    expect(() => createBilanMagicLinkToken({ now: invalidDate })).toThrow('Invalid date');

    const token = createBilanFlowSessionToken({ now, production: false });
    expect(isValidBilanFlowSession({
      requestId: 'request_1',
      tokenHash: token.tokenHash,
      expiresAt: invalidDate,
      revokedAt: null,
    }, {
      rawToken: token.rawToken,
      requestId: 'request_1',
      now,
    })).toBe(false);
    expect(isValidBilanFlowSession({
      requestId: 'request_1',
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: null,
    }, {
      rawToken: token.rawToken,
      requestId: 'request_1',
      now: invalidDate,
    })).toBe(false);
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
    expect(isEligibleBilanMagicLink(record, expected)).toBe(true);
    expect(isEligibleBilanMagicLink({ ...record, consumedAt: now }, expected)).toBe(false);
    expect(isEligibleBilanMagicLink({ ...record, revokedAt: now }, expected)).toBe(false);
    expect(isEligibleBilanMagicLink({ ...record, expiresAt: now }, expected)).toBe(false);
    expect(isEligibleBilanMagicLink(record, { ...expected, requestId: 'request_2' })).toBe(false);
    expect(isEligibleBilanMagicLink(record, { ...expected, parentUserId: 'parent_2' })).toBe(false);
  });

  it('consumes a magic link atomically with hash, scope and live-state predicates', async () => {
    const token = createBilanMagicLinkToken({ now });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository: BilanMagicLinkConsumptionRepository = {
      bilanMagicLink: { updateMany },
    };

    await expect(consumeBilanMagicLinkAtomically(repository, {
      rawToken: token.rawToken,
      requestId: 'request_00000001',
      parentUserId: 'parent_000000001',
      now,
    })).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: token.tokenHash,
        requestId: 'request_00000001',
        parentUserId: 'parent_000000001',
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        consumedAt: now,
      },
    });
  });

  it('allows only one successful atomic consumption under concurrent replay', async () => {
    const token = createBilanMagicLinkToken({ now });
    let consumed = false;
    const updateMany = jest.fn(async () => {
      if (consumed) {
        return { count: 0 };
      }
      consumed = true;
      return { count: 1 };
    });
    const repository: BilanMagicLinkConsumptionRepository = {
      bilanMagicLink: { updateMany },
    };

    const results = await Promise.all([
      consumeBilanMagicLinkAtomically(repository, {
        rawToken: token.rawToken,
        requestId: 'request_00000001',
        now,
      }),
      consumeBilanMagicLinkAtomically(repository, {
        rawToken: token.rawToken,
        requestId: 'request_00000001',
        now,
      }),
    ]);

    expect(results.sort()).toEqual([false, true]);
  });

  it('does not query storage for malformed tokens or invalid dates', async () => {
    const updateMany = jest.fn();
    const repository: BilanMagicLinkConsumptionRepository = {
      bilanMagicLink: { updateMany },
    };

    await expect(consumeBilanMagicLinkAtomically(repository, {
      rawToken: 'invalid',
      requestId: 'request_00000001',
      now,
    })).resolves.toBe(false);
    await expect(consumeBilanMagicLinkAtomically(repository, {
      rawToken: createBilanMagicLinkToken({ now }).rawToken,
      requestId: 'request_00000001',
      now: new Date(Number.NaN),
    })).resolves.toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
