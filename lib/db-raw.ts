/**
 * Centralized raw SQL execution helper.
 *
 * All raw SQL in the codebase MUST go through this module.
 * It enforces parameterized queries and rejects any query
 * that appears to contain string interpolation.
 *
 * STATUS (2026-04-21): NEX-42 and NEX-43 are CLOSED. All unjustified raw SQL
 * usages have been migrated to Prisma client typed queries in LOT 5 step 2.
 * This helper is kept for justified raw SQL cases:
 * - invoice_sequences (atomic INSERT ON CONFLICT RETURNING)
 * - pgvector similarity search (operator <=> not supported by Prisma)
 * - health check diagnostic (SELECT 1)
 *
 * @module lib/db-raw
 */

import { PrismaClient } from '@prisma/client';

/**
 * Validate that a SQL query string is a static template (no interpolation).
 * Rejects queries containing `${` which would indicate unsafe string building.
 */
function assertSafeQuery(sql: string): void {
  if (sql.includes('${')) {
    throw new Error(
      '[db-raw] SECURITY: Rejected query containing string interpolation. ' +
      'Use parameterized placeholders ($1, $2, ...) instead.'
    );
  }
}

/**
 * Execute a parameterized raw SQL command (INSERT, UPDATE, DELETE).
 *
 * @param prisma - Prisma client instance
 * @param sql - SQL with $1, $2, ... placeholders (NO string interpolation)
 * @param params - Positional parameters matching $1, $2, ...
 * @returns Number of affected rows
 */
export async function dbExecute(
  prisma: PrismaClient,
  sql: string,
  ...params: unknown[]
): Promise<number> {
  assertSafeQuery(sql);
  return prisma.$executeRawUnsafe(sql, ...params);
}

/**
 * Execute a parameterized raw SQL query (SELECT).
 *
 * @param prisma - Prisma client instance
 * @param sql - SQL with $1, $2, ... placeholders (NO string interpolation)
 * @param params - Positional parameters matching $1, $2, ...
 * @returns Array of typed rows
 */
export async function dbQuery<T>(
  prisma: PrismaClient,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  assertSafeQuery(sql);
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}
