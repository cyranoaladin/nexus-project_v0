/**
 * Unit tests for Signed Bilan Tokens (signed-token.ts)
 *
 * Tests: signBilanToken, verifyBilanToken, generateBilanToken
 * Validates: signing, verification, expiry, audience restriction, tampering detection.
 */

import {
  signBilanToken,
  verifyBilanToken,
  generateBilanToken,
  type BilanTokenPayload,
} from '@/lib/diagnostics/signed-token';

// Set a test secret
beforeAll(() => {
  process.env.BILAN_TOKEN_SECRET = 'test-secret-key-for-unit-tests-only';
});

afterAll(() => {
  delete process.env.BILAN_TOKEN_SECRET;
});

describe('signBilanToken + verifyBilanToken', () => {
  it('should sign and verify a valid token', () => {
    const payload: BilanTokenPayload = {
      shareId: 'test-share-id-123',
      audience: 'eleve',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    const token = signBilanToken(payload);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    const verified = verifyBilanToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.shareId).toBe('test-share-id-123');
    expect(verified!.audience).toBe('eleve');
  });

  it('should verify parents audience', () => {
    const payload: BilanTokenPayload = {
      shareId: 'parent-share-id',
      audience: 'parents',
      exp: Date.now() + 1000000,
    };

    const token = signBilanToken(payload);
    const verified = verifyBilanToken(token);

    expect(verified).not.toBeNull();
    expect(verified!.audience).toBe('parents');
  });

  it('should reject expired tokens', () => {
    const payload: BilanTokenPayload = {
      shareId: 'expired-share-id',
      audience: 'eleve',
      exp: Date.now() - 1000, // Already expired
    };

    const token = signBilanToken(payload);
    const verified = verifyBilanToken(token);

    expect(verified).toBeNull();
  });

  it('should reject tampered tokens', () => {
    const payload: BilanTokenPayload = {
      shareId: 'original-id',
      audience: 'eleve',
      exp: Date.now() + 1000000,
    };

    const token = signBilanToken(payload);

    // Tamper with the payload part
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({
      ...payload,
      shareId: 'hacked-id',
    })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${parts[1]}`;

    const verified = verifyBilanToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it('should reject malformed tokens', () => {
    expect(verifyBilanToken('')).toBeNull();
    expect(verifyBilanToken('not-a-token')).toBeNull();
    expect(verifyBilanToken('a.b.c')).toBeNull();
    expect(verifyBilanToken('invalid-base64.invalid-sig')).toBeNull();
  });

  it('should reject tokens with invalid audience', () => {
    // Manually craft a token with invalid audience
    const payload = {
      shareId: 'test-id',
      audience: 'nexus', // Not allowed for signed tokens
      exp: Date.now() + 1000000,
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const { createHmac } = require('crypto');
    const signature = createHmac('sha256', process.env.BILAN_TOKEN_SECRET!)
      .update(payloadB64)
      .digest('base64url');
    const token = `${payloadB64}.${signature}`;

    const verified = verifyBilanToken(token);
    expect(verified).toBeNull();
  });
});

describe('generateBilanToken', () => {
  it('should generate a valid token with default 30-day expiry', () => {
    const token = generateBilanToken('share-123', 'eleve');
    const verified = verifyBilanToken(token);

    expect(verified).not.toBeNull();
    expect(verified!.shareId).toBe('share-123');
    expect(verified!.audience).toBe('eleve');

    // Expiry should be ~30 days from now
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(verified!.exp).toBeGreaterThan(Date.now() + thirtyDaysMs - 60000);
    expect(verified!.exp).toBeLessThan(Date.now() + thirtyDaysMs + 60000);
  });

  it('should generate a valid token with custom expiry', () => {
    const token = generateBilanToken('share-456', 'parents', 7);
    const verified = verifyBilanToken(token);

    expect(verified).not.toBeNull();
    expect(verified!.shareId).toBe('share-456');
    expect(verified!.audience).toBe('parents');

    // Expiry should be ~7 days from now
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(verified!.exp).toBeGreaterThan(Date.now() + sevenDaysMs - 60000);
    expect(verified!.exp).toBeLessThan(Date.now() + sevenDaysMs + 60000);
  });

  it('should generate different tokens for different audiences', () => {
    const eleveToken = generateBilanToken('same-share', 'eleve');
    const parentsToken = generateBilanToken('same-share', 'parents');

    expect(eleveToken).not.toBe(parentsToken);
  });

  it('should generate different tokens for different shareIds', () => {
    const token1 = generateBilanToken('share-a', 'eleve');
    const token2 = generateBilanToken('share-b', 'eleve');

    expect(token1).not.toBe(token2);
  });
});
