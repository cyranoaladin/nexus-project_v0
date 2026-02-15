/**
 * Password Reset Tokens — HMAC-SHA256 signed tokens with expiry.
 *
 * Stateless approach: token encodes userId + expiry, signed with server secret.
 * No database table needed. Token is single-use because the password hash changes
 * after reset, invalidating any previously generated tokens for the same user.
 *
 * Security:
 *   - HMAC includes the user's current password hash, so token is invalidated after reset
 *   - Timing-safe comparison prevents timing attacks
 *   - Short expiry (1 hour default)
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Token payload */
export interface ResetTokenPayload {
  /** User ID */
  userId: string;
  /** User email (for display purposes) */
  email: string;
  /** Expiry timestamp (ms since epoch) */
  exp: number;
}

/**
 * Get the signing secret from environment.
 */
function getSecret(): string {
  const secret = process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('PASSWORD_RESET_SECRET or NEXTAUTH_SECRET must be set');
  }
  return secret;
}

/**
 * Generate a password reset token.
 *
 * The HMAC includes the user's current password hash so the token becomes
 * invalid as soon as the password is changed (single-use guarantee).
 *
 * @param userId - The user's ID
 * @param email - The user's email
 * @param currentPasswordHash - The user's current hashed password (used as part of HMAC key)
 * @param expiryMinutes - Token validity in minutes (default 60)
 * @returns The signed token string
 */
export function generateResetToken(
  userId: string,
  email: string,
  currentPasswordHash: string | null,
  expiryMinutes = 60
): string {
  const secret = getSecret();
  const payload: ResetTokenPayload = {
    userId,
    email,
    exp: Date.now() + expiryMinutes * 60 * 1000,
  };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');

  // Include password hash in HMAC so token is invalidated after password change
  const hmacKey = `${secret}:${currentPasswordHash || 'no-password'}`;
  const signature = createHmac('sha256', hmacKey).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode a password reset token.
 *
 * @param token - The signed token string
 * @param currentPasswordHash - The user's current hashed password (must match what was used to generate)
 * @returns The decoded payload, or null if invalid/expired
 */
export function verifyResetToken(
  token: string,
  currentPasswordHash: string | null
): ResetTokenPayload | null {
  try {
    const secret = getSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;

    // Recompute HMAC with same key
    const hmacKey = `${secret}:${currentPasswordHash || 'no-password'}`;
    const expectedSig = createHmac('sha256', hmacKey).update(payloadB64).digest('base64url');

    // Timing-safe comparison
    const sigBuf = Buffer.from(signature, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr) as ResetTokenPayload;

    // Check expiry
    if (payload.exp < Date.now()) {
      return null;
    }

    // Validate required fields
    if (!payload.userId || !payload.email) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
