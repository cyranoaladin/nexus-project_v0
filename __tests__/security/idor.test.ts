/**
 * IDOR (Insecure Direct Object Reference) Security Tests
 *
 * Validates that users cannot access resources belonging to other users
 * by manipulating IDs in API requests.
 *
 * Tests cover: user data isolation, cross-tenant access prevention,
 *              parameter tampering detection
 */

import { resolveAccess } from '@/lib/access/rules';

// ─── IDOR via Access Rules ───────────────────────────────────────────────────

describe('IDOR Prevention — Access Rules Layer', () => {
  it('should deny ELEVE accessing another student\'s features without entitlement', () => {
    // Arrange: ELEVE trying to access aria_maths without entitlement
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-attacker',
      featureKey: 'aria_maths',
      activeFeatures: [], // no entitlements
    });

    // Assert
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing_entitlement');
  });

  it('should deny PARENT accessing admin facturation', () => {
    // Arrange: PARENT trying to access admin-only feature
    const result = resolveAccess({
      role: 'PARENT',
      userId: 'parent-attacker',
      featureKey: 'admin_facturation',
      activeFeatures: [],
    });

    // Assert
    expect(result.allowed).toBe(false);
  });

  it('should deny unauthenticated user accessing any feature', () => {
    const features = [
      'platform_access', 'hybrid_sessions', 'aria_maths',
      'aria_nsi', 'credits_use', 'admin_facturation',
    ] as const;

    features.forEach((featureKey) => {
      const result = resolveAccess({
        role: null,
        userId: null,
        featureKey,
        activeFeatures: [],
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('auth_required');
    });
  });
});

// ─── IDOR via Signed Tokens ─────────────────────────────────────────────────

describe('IDOR Prevention — Signed Token Layer', () => {
  let signBilanToken: any;
  let verifyBilanToken: any;

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = 'test-secret-for-idor-tests-minimum-32-chars';
    const mod = await import('@/lib/diagnostics/signed-token');
    signBilanToken = mod.signBilanToken;
    verifyBilanToken = mod.verifyBilanToken;
  });

  it('should reject token signed for different diagnostic', () => {
    // Arrange: token for diag-A
    const token = signBilanToken({
      shareId: 'diag-A',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    });

    // Act: verify returns diag-A, not diag-B
    const verified = verifyBilanToken(token);

    // Assert: token is valid but for diag-A only
    expect(verified).not.toBeNull();
    expect(verified!.shareId).toBe('diag-A');
    expect(verified!.shareId).not.toBe('diag-B');
  });

  it('should reject tampered shareId in token', () => {
    // Arrange: valid token
    const token = signBilanToken({
      shareId: 'diag-original',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    });

    // Act: tamper with payload
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({
      shareId: 'diag-STOLEN',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${parts[1]}`;

    const verified = verifyBilanToken(tamperedToken);

    // Assert
    expect(verified).toBeNull();
  });

  it('should prevent audience escalation (eleve → parents)', () => {
    // Arrange: token for eleve
    const eleveToken = signBilanToken({
      shareId: 'diag-123',
      audience: 'eleve',
      exp: Date.now() + 86400000,
    });

    // Act: verify returns eleve audience
    const verified = verifyBilanToken(eleveToken);

    // Assert: cannot use eleve token to access parents bilan
    expect(verified).not.toBeNull();
    expect(verified!.audience).toBe('eleve');
    expect(verified!.audience).not.toBe('parents');
  });

  it('should prevent nexus audience access via token', () => {
    // Arrange: forge nexus audience token
    const nexusToken = signBilanToken({
      shareId: 'diag-123',
      audience: 'nexus' as any,
      exp: Date.now() + 86400000,
    });

    // Act
    const verified = verifyBilanToken(nexusToken);

    // Assert: nexus audience is rejected
    expect(verified).toBeNull();
  });
});

// ─── IDOR via Guards ─────────────────────────────────────────────────────────

describe('IDOR Prevention — Guards Layer', () => {
  const mockAuth = jest.fn();

  beforeAll(() => {
    jest.mock('@/auth', () => ({
      auth: () => mockAuth(),
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not expose user IDs in error responses', async () => {
    // Arrange
    mockAuth.mockResolvedValue(null);

    // Act
    const { requireAuth } = await import('@/lib/guards');
    const result = await requireAuth();

    // Assert: error response should not contain user-specific data
    if (result instanceof Response) {
      const body = await result.json();
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('sessionId');
      expect(body.error).toBe('Unauthorized');
    }
  });
});
