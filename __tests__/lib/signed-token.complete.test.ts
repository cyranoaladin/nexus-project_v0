/**
 * Signed Bilan Tokens — Complete Test Suite
 *
 * Tests: signBilanToken, verifyBilanToken, generateBilanToken
 *
 * Source: lib/diagnostics/signed-token.ts
 */

import {
  signBilanToken,
  verifyBilanToken,
  generateBilanToken,
  type BilanTokenPayload,
} from '@/lib/diagnostics/signed-token';

// Ensure NEXTAUTH_SECRET is set for signing
beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-for-signed-tokens-minimum-32-chars';
});

// ─── signBilanToken + verifyBilanToken ───────────────────────────────────────

describe('signBilanToken + verifyBilanToken', () => {
  it('should sign and verify a valid token successfully', () => {
    // Arrange
    const payload: BilanTokenPayload = {
      shareId: 'diag-123',
      audience: 'eleve',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    // Act
    const token = signBilanToken(payload);
    const verified = verifyBilanToken(token);

    // Assert
    expect(verified).not.toBeNull();
    expect(verified!.shareId).toBe('diag-123');
    expect(verified!.audience).toBe('eleve');
  });

  it('should reject a tampered token payload', () => {
    // Arrange
    const payload: BilanTokenPayload = {
      shareId: 'diag-123',
      audience: 'eleve',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    const token = signBilanToken(payload);

    // Act: tamper with the payload part
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({
      ...payload,
      shareId: 'diag-HACKED',
    })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${parts[1]}`;

    const verified = verifyBilanToken(tamperedToken);

    // Assert
    expect(verified).toBeNull();
  });

  it('should reject a token with wrong HMAC signature', () => {
    // Arrange
    const payload: BilanTokenPayload = {
      shareId: 'diag-123',
      audience: 'eleve',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    const token = signBilanToken(payload);

    // Act: replace signature with garbage
    const parts = token.split('.');
    const fakeSignature = Buffer.from('fake-signature-data').toString('base64url');
    const fakeToken = `${parts[0]}.${fakeSignature}`;

    const verified = verifyBilanToken(fakeToken);

    // Assert
    expect(verified).toBeNull();
  });

  it('should reject an expired token (exp in past)', () => {
    // Arrange
    const payload: BilanTokenPayload = {
      shareId: 'diag-123',
      audience: 'eleve',
      exp: Date.now() - 1000, // expired 1 second ago
    };

    // Act
    const token = signBilanToken(payload);
    const verified = verifyBilanToken(token);

    // Assert
    expect(verified).toBeNull();
  });

  it('should reject a token for wrong audience (nexus audience)', () => {
    // Arrange: force nexus audience (not allowed)
    const payload = {
      shareId: 'diag-123',
      audience: 'nexus' as any,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    // Act
    const token = signBilanToken(payload as BilanTokenPayload);
    const verified = verifyBilanToken(token);

    // Assert: nexus is not in ['eleve', 'parents']
    expect(verified).toBeNull();
  });

  it('should accept eleve audience token', () => {
    // Arrange
    const payload: BilanTokenPayload = {
      shareId: 'diag-456',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    };

    // Act
    const token = signBilanToken(payload);
    const verified = verifyBilanToken(token);

    // Assert
    expect(verified).not.toBeNull();
    expect(verified!.audience).toBe('eleve');
  });

  it('should accept parents audience token', () => {
    // Arrange
    const payload: BilanTokenPayload = {
      shareId: 'diag-789',
      audience: 'parents',
      exp: Date.now() + 86400000,
    };

    // Act
    const token = signBilanToken(payload);
    const verified = verifyBilanToken(token);

    // Assert
    expect(verified).not.toBeNull();
    expect(verified!.audience).toBe('parents');
  });

  it('should not replay: same token verified twice still valid (stateless)', () => {
    // Arrange
    const payload: BilanTokenPayload = {
      shareId: 'diag-123',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    };
    const token = signBilanToken(payload);

    // Act
    const v1 = verifyBilanToken(token);
    const v2 = verifyBilanToken(token);

    // Assert: both should succeed (stateless verification)
    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    expect(v1!.shareId).toBe(v2!.shareId);
  });

  it('should produce different tokens for different diagnosticIds', () => {
    // Arrange
    const payload1: BilanTokenPayload = {
      shareId: 'diag-AAA',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    };
    const payload2: BilanTokenPayload = {
      shareId: 'diag-BBB',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    };

    // Act
    const token1 = signBilanToken(payload1);
    const token2 = signBilanToken(payload2);

    // Assert
    expect(token1).not.toBe(token2);
  });

  it('should produce different tokens for different audiences', () => {
    // Arrange
    const base = {
      shareId: 'diag-123',
      exp: Date.now() + 86400000,
    };

    // Act
    const eleveToken = signBilanToken({ ...base, audience: 'eleve' });
    const parentsToken = signBilanToken({ ...base, audience: 'parents' });

    // Assert
    expect(eleveToken).not.toBe(parentsToken);
  });

  it('should reject malformed token (no dot separator)', () => {
    expect(verifyBilanToken('no-dot-separator')).toBeNull();
  });

  it('should reject malformed token (too many parts)', () => {
    expect(verifyBilanToken('a.b.c')).toBeNull();
  });

  it('should reject empty string token', () => {
    expect(verifyBilanToken('')).toBeNull();
  });

  it('should have token format: base64url(payload).base64url(hmac)', () => {
    // Arrange
    const payload: BilanTokenPayload = {
      shareId: 'diag-format',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    };

    // Act
    const token = signBilanToken(payload);

    // Assert: two parts separated by dot
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    // Both parts should be valid base64url
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ─── generateBilanToken ──────────────────────────────────────────────────────

describe('generateBilanToken', () => {
  it('should generate a verifiable token for eleve audience', () => {
    // Act
    const token = generateBilanToken('share-123', 'eleve');
    const verified = verifyBilanToken(token);

    // Assert
    expect(verified).not.toBeNull();
    expect(verified!.shareId).toBe('share-123');
    expect(verified!.audience).toBe('eleve');
  });

  it('should generate a verifiable token for parents audience', () => {
    // Act
    const token = generateBilanToken('share-456', 'parents');
    const verified = verifyBilanToken(token);

    // Assert
    expect(verified).not.toBeNull();
    expect(verified!.audience).toBe('parents');
  });

  it('should default to 30-day expiry', () => {
    // Act
    const token = generateBilanToken('share-789', 'eleve');
    const verified = verifyBilanToken(token);

    // Assert: expiry should be ~30 days from now
    expect(verified).not.toBeNull();
    const expectedExp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(verified!.exp).toBeGreaterThan(Date.now());
    expect(Math.abs(verified!.exp - expectedExp)).toBeLessThan(5000); // within 5s
  });

  it('should accept custom expiry days', () => {
    // Act
    const token = generateBilanToken('share-custom', 'eleve', 7);
    const verified = verifyBilanToken(token);

    // Assert: expiry should be ~7 days from now
    expect(verified).not.toBeNull();
    const expectedExp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(verified!.exp - expectedExp)).toBeLessThan(5000);
  });

  it('should handle Idempotency-Key correctly (same inputs → different tokens due to exp)', () => {
    // Act: two tokens generated at slightly different times
    const token1 = generateBilanToken('share-idem', 'eleve');
    const token2 = generateBilanToken('share-idem', 'eleve');

    // Assert: tokens may differ due to timestamp precision
    // But both should verify successfully
    expect(verifyBilanToken(token1)).not.toBeNull();
    expect(verifyBilanToken(token2)).not.toBeNull();
  });
});
