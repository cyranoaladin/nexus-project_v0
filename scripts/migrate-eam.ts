import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

  console.log("Table eam_progress creee ou deja existante.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
