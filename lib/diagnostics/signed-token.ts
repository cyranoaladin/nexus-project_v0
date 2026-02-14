/**
 * Signed Audience Tokens — JWT-signed URLs with expiry for parent/student bilan access.
 *
 * Instead of exposing raw publicShareId, generate a signed token that encodes:
 *   - diagnosticId
 *   - audience (eleve | parents)
 *   - expiry (default 30 days)
 *
 * URL format: /bilan-pallier2-maths/resultat/[id]?t=SIGNED_TOKEN
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Token payload */
export interface BilanTokenPayload {
  /** Diagnostic publicShareId */
  shareId: string;
  /** Audience: eleve or parents (nexus requires staff auth) */
  audience: 'eleve' | 'parents';
  /** Expiry timestamp (ms since epoch) */
  exp: number;
}

/**
 * Get the signing secret from environment.
 * Falls back to NEXTAUTH_SECRET if BILAN_TOKEN_SECRET is not set.
 */
function getSecret(): string {
  const secret = process.env.BILAN_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('BILAN_TOKEN_SECRET or NEXTAUTH_SECRET must be set');
  }
  return secret;
}

/**
 * Sign a payload into a URL-safe token.
 * Format: base64url(payload).base64url(hmac)
 */
export function signBilanToken(payload: BilanTokenPayload): string {
  const secret = getSecret();
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode a signed bilan token.
 * Returns null if invalid or expired.
 */
export function verifyBilanToken(token: string): BilanTokenPayload | null {
  try {
    const secret = getSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');

    // Timing-safe comparison
    const sigBuf = Buffer.from(signature, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr) as BilanTokenPayload;

    // Check expiry
    if (payload.exp < Date.now()) {
      return null;
    }

    // Validate audience
    if (!['eleve', 'parents'].includes(payload.audience)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate a signed bilan URL for a specific audience.
 *
 * @param shareId - The diagnostic publicShareId
 * @param audience - 'eleve' or 'parents'
 * @param expiryDays - Token validity in days (default 30)
 * @returns The signed token string
 */
export function generateBilanToken(
  shareId: string,
  audience: 'eleve' | 'parents',
  expiryDays = 30
): string {
  const payload: BilanTokenPayload = {
    shareId,
    audience,
    exp: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
  };
  return signBilanToken(payload);
}
