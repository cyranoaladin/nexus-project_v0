-- Forward-only. Bind bootstrap to this database instance, not a shared namespace.
ALTER TABLE "core_v2_database_identity"
  ADD COLUMN "instanceId" UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "core_v2_database_identity_instanceId_key"
  ON "core_v2_database_identity"("instanceId");

CREATE TABLE "core_admin_bootstrap" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "v1UserId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_admin_bootstrap_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_admin_bootstrap_singleton" CHECK (id = 1),
  CONSTRAINT "core_admin_bootstrap_fingerprint_check" CHECK ("fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "core_admin_bootstrap_v1UserId_fkey" FOREIGN KEY ("v1UserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_admin_bootstrap_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "audit_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "core_admin_bootstrap_v1UserId_key" ON "core_admin_bootstrap"("v1UserId");
CREATE UNIQUE INDEX "core_admin_bootstrap_receiptId_key" ON "core_admin_bootstrap"("receiptId");
CREATE UNIQUE INDEX "core_admin_bootstrap_nonce_key" ON "core_admin_bootstrap"("nonce");
REVOKE ALL ON "core_admin_bootstrap" FROM PUBLIC;

CREATE FUNCTION core_admin_bootstrap_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'BOOTSTRAP_ATTESTATION_IMMUTABLE' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER core_admin_bootstrap_immutable
  BEFORE UPDATE OR DELETE ON "core_admin_bootstrap"
  FOR EACH ROW EXECUTE FUNCTION core_admin_bootstrap_immutable();

-- Deferred so ADMIN, receipt and attestation commit atomically. Infrastructure
-- superusers used solely by disposable tests can manufacture corrupt fixtures;
-- production owner is NOLOGIN, and all application/tooling roles are non-superuser.
CREATE FUNCTION core_admin_bootstrap_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolsuper) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.core_admin_bootstrap b
    JOIN public.users u ON u.id = b."v1UserId"
    JOIN public.audit_events a ON a.id = b."receiptId"
    JOIN public.core_v2_database_identity d ON d.id = 1
    WHERE b.id = 1 AND u.role = 'ADMIN' AND u.password IS NULL
      AND a.action = 'account.bootstrap_v1_admin' AND a."subjectType" = 'User'
      AND a."subjectId" = b."v1UserId" AND a."actorUserId" = b."v1UserId"
      AND a."correlationId" = b.nonce AND a.metadata = b.manifest
      AND b.manifest->>'databaseIdentity' = d."instanceId"::text
      AND b.manifest->>'v1UserId' = b."v1UserId"
      AND b.manifest->>'nonce' = b.nonce AND b.manifest->>'fingerprint' = b.fingerprint
      AND b.manifest->>'capability' = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'UNATTESTED_ADMIN_STATE' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER core_admin_bootstrap_integrity
  AFTER INSERT ON "core_admin_bootstrap" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core_admin_bootstrap_integrity();
CREATE CONSTRAINT TRIGGER core_admin_requires_attestation
  AFTER INSERT OR UPDATE ON "users" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (NEW.role = 'ADMIN') EXECUTE FUNCTION core_admin_bootstrap_integrity();
