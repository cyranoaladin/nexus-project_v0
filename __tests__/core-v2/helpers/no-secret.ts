import type { PrismaClient } from '@/core-v2/generated/client';

/**
 * Proves a set of secret strings appears NOWHERE in the Core v2 database: every
 * base table of the public schema is serialized row by row and searched.
 * Test-only; the raw SQL is deliberate and parameterless apart from the table
 * name taken from the catalog.
 */
export async function assertNoSecretInCore(client: PrismaClient, secrets: readonly string[]): Promise<void> {
  const tables = await client.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
  expect(tables.length).toBeGreaterThan(10);
  for (const { table_name: table } of tables) {
    for (const secret of secrets) {
      const hits = await client.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM "${table}" t WHERE position($1 in t::text) > 0`,
        secret,
      );
      if ((hits[0]?.n ?? 0) !== 0) throw new Error(`SECRET_PRESENT_IN_CORE_TABLE:${table}`);
    }
  }
}
