/**
 * InvoiceAccessToken — generate, hash, and verify tokens for external PDF access.
 *
 * Design:
 * - Raw token = crypto.randomBytes(32).toString('hex') → 64-char hex string
 * - Stored as SHA-256 hash (never store raw token in DB)
 * - Default expiry: 72 hours
 * - Verification: hash the incoming token, lookup by hash, check expiry + revocation
 */

import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default token validity in hours. */
export const TOKEN_EXPIRY_HOURS = 72;

// ─── Pure helpers (no DB, testable) ──────────────────────────────────────────

/**
 * Generate a cryptographically secure random token (64-char hex).
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash of a raw token string.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Compute expiry date from now + hours.
 */
export function computeExpiresAt(hours: number = TOKEN_EXPIRY_HOURS): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ─── DB operations ───────────────────────────────────────────────────────────

export interface CreateTokenResult {
  /** Raw token to include in the email link (never stored). */
  rawToken: string;
  /** Token record ID. */
  tokenId: string;
  /** Expiry date. */
  expiresAt: Date;
}

/**
 * Create an access token for an invoice.
 * Returns the raw token (to embed in email) — it is NOT stored, only the hash is.
 */
export async function createAccessToken(
  invoiceId: string,
  createdByUserId: string,
  expiryHours: number = TOKEN_EXPIRY_HOURS
): Promise<CreateTokenResult> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = computeExpiresAt(expiryHours);

  const record = await prisma.invoiceAccessToken.create({
    data: {
      invoiceId,
      tokenHash,
      expiresAt,
      createdByUserId,
    },
  });

  return { rawToken, tokenId: record.id, expiresAt };
}

export interface VerifyTokenResult {
  valid: boolean;
  invoiceId?: string;
  reason?: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED';
}

/**
 * Verify an access token. Returns the invoiceId if valid.
 * Single DB hit: lookup by hash, then check expiry + revocation in memory.
 */
export async function verifyAccessToken(rawToken: string): Promise<VerifyTokenResult> {
  const tokenHash = hashToken(rawToken);

  const record = await prisma.invoiceAccessToken.findUnique({
    where: { tokenHash },
    select: { invoiceId: true, expiresAt: true, revokedAt: true },
  });

  if (!record) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  if (record.revokedAt) {
    return { valid: false, reason: 'REVOKED' };
  }

  if (new Date() > record.expiresAt) {
    return { valid: false, reason: 'EXPIRED' };
  }

  return { valid: true, invoiceId: record.invoiceId };
}

/**
 * Prisma transaction client type — accepts either the global prisma or a $transaction tx.
 */
type PrismaTransactionClient = typeof prisma;

/**
 * Revoke all active tokens for an invoice (e.g. on payment or cancellation).
 *
 * @param invoiceId - Invoice to revoke tokens for
 * @param tx - Optional Prisma transaction client for atomic operations
 * @returns Number of tokens revoked
 */
export async function revokeTokensForInvoice(
  invoiceId: string,
  tx?: PrismaTransactionClient
): Promise<number> {
  const client = tx ?? prisma;
  const result = await client.invoiceAccessToken.updateMany({
    where: {
      invoiceId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
  return result.count;
}
