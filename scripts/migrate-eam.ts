import { PrismaClient } from "@prisma/client";

/**
 * Ensure the eam_progress table exists.
 *
 * This table is NOT in the Prisma schema — it was created via raw SQL on prod.
 * This function is the SINGLE SOURCE OF TRUTH for the DDL.
 * It is called by:
 *   - This script (standalone prod migration)
 *   - scripts/seed-e2e-db.ts (E2E database seeding)
 *
 * TODO(unification-db): migrate eam_progress into prisma/schema.prisma
 * and delete this file.
 */
export async function ensureEamProgressTable(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS eam_progress (
      id          TEXT        PRIMARY KEY,
      user_id     TEXT        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      checks      JSONB       NOT NULL DEFAULT '{}',
      quiz        JSONB       NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_eam_progress_user_id ON eam_progress(user_id);
  `);
}

// Standalone execution (prod migration)
if (require.main === module) {
  const prisma = new PrismaClient();
  ensureEamProgressTable(prisma)
    .then(() => console.log("Table eam_progress creee ou deja existante."))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
