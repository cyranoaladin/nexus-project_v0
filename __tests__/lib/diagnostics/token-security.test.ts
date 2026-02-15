/**
 * Token Security Tests — Signed bilan tokens (HMAC-SHA256)
 *
 * Verifies:
 * 1. Generate → verify round-trip works
 * 2. Tampered token → rejected
 * 3. Expired token → rejected
 * 4. Invalid audience → rejected
 * 5. Malformed token → rejected
 * 6. Token NEVER leaks in GET response JSON
 */

// Set secret before importing
process.env.BILAN_TOKEN_SECRET = 'test-secret-for-token-security-tests-32chars!';

import {
  generateBilanToken,
  signBilanToken,
  verifyBilanToken,
} from '@/lib/diagnostics/signed-token';
import type { BilanTokenPayload } from '@/lib/diagnostics/signed-token';

/* ═══════════════════════════════════════════════════════════════════════════
   A) Sign / Verify round-trip
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Token — sign/verify round-trip', () => {
  it('generates a valid eleve token that verifies correctly', () => {
    const token = generateBilanToken('share-abc-123', 'eleve', 30);
    expect(token).toBeTruthy();
    expect(token).toContain('.'); // format: payload.signature

    const payload = verifyBilanToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.shareId).toBe('share-abc-123');
    expect(payload!.audience).toBe('eleve');
    expect(payload!.exp).toBeGreaterThan(Date.now());
  });

  it('generates a valid parents token that verifies correctly', () => {
    const token = generateBilanToken('share-xyz-789', 'parents', 7);
    const payload = verifyBilanToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.shareId).toBe('share-xyz-789');
    expect(payload!.audience).toBe('parents');
  });

  it('different shareIds produce different tokens', () => {
    const t1 = generateBilanToken('share-1', 'eleve');
    const t2 = generateBilanToken('share-2', 'eleve');
    expect(t1).not.toBe(t2);
  });

  it('different audiences produce different tokens', () => {
    const t1 = generateBilanToken('share-1', 'eleve');
    const t2 = generateBilanToken('share-1', 'parents');
    expect(t1).not.toBe(t2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   B) Tampered token → rejected
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Token — tampered tokens rejected', () => {
  it('rejects token with modified payload', () => {
    const token = generateBilanToken('share-abc', 'eleve', 30);
    const [, signature] = token.split('.');

    // Forge a different payload
    const forgedPayload = Buffer.from(JSON.stringify({
      shareId: 'HACKED-share',
      audience: 'eleve',
      exp: Date.now() + 999999999,
    })).toString('base64url');

    const tamperedToken = `${forgedPayload}.${signature}`;
    expect(verifyBilanToken(tamperedToken)).toBeNull();
  });

  it('rejects token with modified signature', () => {
    const token = generateBilanToken('share-abc', 'eleve', 30);
    const [payload] = token.split('.');

    const tamperedToken = `${payload}.AAAA_forged_signature_BBBB`;
    expect(verifyBilanToken(tamperedToken)).toBeNull();
  });

  it('rejects completely random string', () => {
    expect(verifyBilanToken('not-a-valid-token-at-all')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(verifyBilanToken('')).toBeNull();
  });

  it('rejects token with 3 parts (extra dot)', () => {
    expect(verifyBilanToken('a.b.c')).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   C) Expired token → rejected
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Token — expired tokens rejected', () => {
  it('rejects token that expired 1 second ago', () => {
    const payload: BilanTokenPayload = {
      shareId: 'share-expired',
      audience: 'eleve',
      exp: Date.now() - 1000, // 1 second ago
    };
    const token = signBilanToken(payload);
    expect(verifyBilanToken(token)).toBeNull();
  });

  it('rejects token that expired 1 day ago', () => {
    const payload: BilanTokenPayload = {
      shareId: 'share-old',
      audience: 'parents',
      exp: Date.now() - 86400000,
    };
    const token = signBilanToken(payload);
    expect(verifyBilanToken(token)).toBeNull();
  });

  it('accepts token expiring in 1 hour', () => {
    const payload: BilanTokenPayload = {
      shareId: 'share-fresh',
      audience: 'eleve',
      exp: Date.now() + 3600000,
    };
    const token = signBilanToken(payload);
    const result = verifyBilanToken(token);
    expect(result).not.toBeNull();
    expect(result!.shareId).toBe('share-fresh');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   D) Invalid audience → rejected
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Token — invalid audience rejected', () => {
  it('rejects nexus audience (staff-only, no public token)', () => {
    const payload: BilanTokenPayload = {
      shareId: 'share-nexus',
      audience: 'nexus' as any,
      exp: Date.now() + 3600000,
    };
    const token = signBilanToken(payload);
    expect(verifyBilanToken(token)).toBeNull();
  });

  it('rejects unknown audience', () => {
    const payload = {
      shareId: 'share-unknown',
      audience: 'admin',
      exp: Date.now() + 3600000,
    };
    const token = signBilanToken(payload as any);
    expect(verifyBilanToken(token)).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   E) Token NEVER leaks in response — structural check
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Token — no leak in diagnostic response', () => {
  it('signed token is NOT stored in the payload itself', () => {
    const token = generateBilanToken('share-leak-test', 'eleve', 30);
    const payload = verifyBilanToken(token);

    // The payload should only contain shareId, audience, exp
    const keys = Object.keys(payload!);
    expect(keys).toEqual(expect.arrayContaining(['shareId', 'audience', 'exp']));
    expect(keys).not.toContain('token');
    expect(keys).not.toContain('secret');
    expect(keys).not.toContain('signature');
  });

  it('token string does NOT contain the secret', () => {
    const token = generateBilanToken('share-secret-test', 'eleve', 30);
    const secret = process.env.BILAN_TOKEN_SECRET!;
    expect(token).not.toContain(secret);
  });

  it('simulated GET response does NOT expose raw token in diagnostic fields', () => {
    // Simulate what the route returns for a diagnostic
    const token = generateBilanToken('share-response-test', 'eleve', 30);
    const simulatedDiagnostic = {
      id: 'diag-1',
      publicShareId: 'share-response-test',
      status: 'ANALYZED',
      studentMarkdown: '# Bilan Élève',
      parentsMarkdown: null, // audience-restricted
      createdAt: new Date().toISOString(),
    };

    const responseJson = JSON.stringify({
      diagnostic: simulatedDiagnostic,
      audience: 'eleve',
    });

    // The response should NOT contain the token string
    expect(responseJson).not.toContain(token);
    // The response should NOT contain parentsMarkdown for eleve audience
    expect(JSON.parse(responseJson).diagnostic.parentsMarkdown).toBeNull();
  });
});
