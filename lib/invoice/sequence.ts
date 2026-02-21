/**
 * Invoice Sequence — Atomic invoice number generation.
 *
 * Format: YYYYMM-####  (e.g. 202602-0001)
 *
 * Uses a transactional upsert + increment on InvoiceSequence to guarantee
 * uniqueness even under concurrent requests. The yearMonth column acts as
 * a monthly counter partition.
 *
 * Atomicity is guaranteed by PostgreSQL INSERT ... ON CONFLICT (no external
 * transaction wrapper needed).
 */

import { prisma } from '@/lib/prisma';

/**
 * Generate the next invoice number atomically.
 *
 * Uses a raw SQL query with INSERT ... ON CONFLICT to guarantee atomicity
 * even under concurrent requests, without relying on Prisma transaction client types.
 *
 * @param date - Date to derive yearMonth from (defaults to now)
 * @returns Invoice number string, e.g. "202602-0001"
 * @throws Error if invoice sequence query fails or returns invalid result
 */
export async function generateInvoiceNumber(
  date: Date = new Date()
): Promise<string> {
  const yearMonth = date.getFullYear() * 100 + (date.getMonth() + 1);

  try {
    // Atomic upsert via raw SQL — guaranteed no collision
    const result = await prisma.$queryRaw<Array<{ current: number }>>`
      INSERT INTO "invoice_sequences" ("id", "yearMonth", "current", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${yearMonth}, 1, NOW(), NOW())
      ON CONFLICT ("yearMonth")
      DO UPDATE SET "current" = "invoice_sequences"."current" + 1, "updatedAt" = NOW()
      RETURNING "current"
    `;

    // Strict validation: ensure we got a valid result
    if (!result || result.length === 0 || typeof result[0]?.current !== 'number') {
      throw new Error(
        `Invoice sequence query returned invalid result: ${JSON.stringify(result)}`
      );
    }

    const current = result[0].current;
    const paddedNumber = String(current).padStart(4, '0');
    return `${yearMonth}-${paddedNumber}`;
  } catch (err) {
    // Log error with context and propagate (fail fast — don't generate invoice without valid number)
    console.error('[Invoice] Failed to generate invoice number:', {
      yearMonth,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    
    throw new Error(
      `Failed to generate unique invoice number for ${yearMonth}`,
      { cause: err }
    );
  }
}

/**
 * Parse a yearMonth integer into a human-readable string.
 *
 * @param yearMonth - e.g. 202602
 * @returns "2026-02"
 */
export function formatYearMonth(yearMonth: number): string {
  const year = Math.floor(yearMonth / 100);
  const month = String(yearMonth % 100).padStart(2, '0');
  return `${year}-${month}`;
}
