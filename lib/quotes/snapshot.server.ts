/**
 * Server-only helpers for freezing a Quote's pricing/regulatory/token
 * context at creation time (CDC §24/§26). A quote already sent is never
 * silently recomputed against a later pricing.canonical.json or exam-rules
 * version — every consumer reads these frozen fields from the Quote row,
 * never lib/pricing.ts or lib/exams/catalog.ts directly, once persisted.
 */
import 'server-only';
import { getFullPricingData } from '@/lib/pricing';
import { assertSessionSellable, requireExamPolicy } from '@/lib/exams/catalog';
import { generateRawToken, hashToken, computeExpiresAt } from '@/lib/invoice/access-token';

export interface QuoteContextSnapshot {
  pricingVersion: string;
  examPolicyVersion: string;
}

export function buildQuoteContextSnapshot(examSession: number): QuoteContextSnapshot {
  assertSessionSellable(examSession);
  const pricing = getFullPricingData();
  const examPolicy = requireExamPolicy(examSession);
  return {
    pricingVersion: pricing.version,
    examPolicyVersion: `${examPolicy.session}@${examPolicy.lastVerifiedAt}`,
  };
}

/** Public quote links default to 90 days — long enough to survive a slow family decision, short enough that a stale link isn't trusted forever. */
export const QUOTE_TOKEN_EXPIRY_HOURS = 90 * 24;

export interface QuotePublicToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Reuses the same random-token-then-hash pattern as InvoiceAccessToken — never store the raw token. */
export function generateQuotePublicToken(): QuotePublicToken {
  const rawToken = generateRawToken();
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    expiresAt: computeExpiresAt(QUOTE_TOKEN_EXPIRY_HOURS),
  };
}
