-- E2.5: Create eam_progress on fresh databases before bringing it under Prisma governance.
-- Production originally had this table from a raw SQL helper; CI/fresh DBs need the base DDL.

CREATE TABLE IF NOT EXISTS eam_progress (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  checks JSONB NOT NULL DEFAULT '{}',
  quiz JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "eam_progress_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS "eam_progress_user_id_key" ON eam_progress(user_id);
