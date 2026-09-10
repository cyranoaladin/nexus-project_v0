-- Core v2 foundation hardening — database identity marker
-- (DATABASE_COLLISION_GUARD_WEAKNESS, second independent safety layer
-- alongside lib/core-v2/database-target.ts's URL target comparison).
--
-- CreateTable is the exact output of
-- `prisma migrate diff --from-url $CORE_V2_DATABASE_URL --to-schema-datamodel
-- core-v2/prisma/schema.prisma --script`, so this migration produces zero
-- drift against core-v2/prisma/schema.prisma's CoreV2DatabaseIdentity model.
CREATE TABLE "core_v2_database_identity" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "schemaIdentity" TEXT NOT NULL,
    "schemaGeneration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_v2_database_identity_pkey" PRIMARY KEY ("id")
);

-- Seed the one and only marker row. This is the ONLY place the marker is
-- ever created — lib/core-v2/client.ts only ever reads it, never
-- upserts/creates it, so a database that never ran this migration can never
-- accidentally satisfy the identity check.
INSERT INTO "core_v2_database_identity" ("id", "schemaIdentity", "schemaGeneration")
VALUES (1, 'nexus-core-v2', 2);
