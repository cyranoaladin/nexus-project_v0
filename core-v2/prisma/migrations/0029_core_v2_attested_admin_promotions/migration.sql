-- Every later ADMIN is an explicit, audited promotion. A dedicated NOLOGIN
-- function owner and narrowly privileged promotion LOGIN are configured by the
-- infrastructure provisioner. Runtime/sync/backfill cannot execute promotion,
-- insert its reserved receipt, or SET ROLE to either owner or promotion LOGIN.
CREATE UNIQUE INDEX audit_events_admin_promotion_command_key
  ON public.audit_events ((metadata->>'commandId')) WHERE action = 'account.admin_promoted';

CREATE FUNCTION public.core_reserved_admin_receipt_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolsuper) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.action IN ('account.admin_promoted', 'account.bootstrap_v1_admin') THEN
    RAISE EXCEPTION 'ADMIN_RECEIPT_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  IF NEW.action = 'account.admin_promoted' AND current_user <> 'nexus_core_admin_promoter_owner' THEN
    RAISE EXCEPTION 'RESERVED_ADMIN_RECEIPT' USING ERRCODE = '42501';
  END IF;
  IF NEW.action = 'account.bootstrap_v1_admin' AND current_user <> 'nexus_core_bootstrap' THEN
    RAISE EXCEPTION 'RESERVED_BOOTSTRAP_RECEIPT' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER core_reserved_admin_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.core_reserved_admin_receipt_guard();

-- Immediate SECURITY INVOKER guard retains the identity of the writing role;
-- deferred triggers alone would lose that provenance after a definer returns.
CREATE FUNCTION public.core_admin_write_authority() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolsuper) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'ADMIN' THEN RAISE EXCEPTION 'ADMIN_ROLE_IMMUTABLE' USING ERRCODE = '42501'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.role = 'ADMIN' AND (TG_OP = 'INSERT' OR OLD.role <> 'ADMIN')
    AND current_user NOT IN ('nexus_core_bootstrap', 'nexus_core_admin_promoter_owner') THEN
    RAISE EXCEPTION 'ADMIN_WRITE_AUTHORITY_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER core_admin_write_authority BEFORE INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.core_admin_write_authority();

CREATE OR REPLACE FUNCTION public.core_admin_bootstrap_integrity() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE first_id TEXT; bootstrap_fp TEXT; instance_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'users' AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolsuper) THEN RETURN NULL; END IF;
  SELECT b."v1UserId", b.fingerprint, d."instanceId"::text INTO first_id, bootstrap_fp, instance_id
    FROM public.core_admin_bootstrap b JOIN public.users u ON u.id = b."v1UserId"
    JOIN public.audit_events a ON a.id = b."receiptId" JOIN public.core_v2_database_identity d ON d.id = 1
    WHERE b.id = 1 AND u.role = 'ADMIN' AND u.password IS NULL
      AND a.action = 'account.bootstrap_v1_admin' AND a."subjectType" = 'User'
      AND a."subjectId" = b."v1UserId" AND a."actorUserId" = b."v1UserId"
      AND a."correlationId" = b.nonce AND a.metadata = b.manifest
      AND b.manifest->>'databaseIdentity' = d."instanceId"::text
      AND b.manifest->>'v1UserId' = b."v1UserId" AND b.manifest->>'nonce' = b.nonce
      AND b.manifest->>'fingerprint' = b.fingerprint AND b.manifest->>'capability' = 'ADMIN';
  IF first_id IS NULL THEN RAISE EXCEPTION 'UNATTESTED_ADMIN_STATE' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'users' THEN
    IF NEW.role <> 'ADMIN' OR NEW.password IS NOT NULL THEN
      RAISE EXCEPTION 'ADMIN_ROLE_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    IF NEW.id = first_id THEN
      IF TG_OP = 'INSERT' AND current_user <> 'nexus_core_bootstrap' THEN
        RAISE EXCEPTION 'EXCLUSIVE_ADMIN_BOOTSTRAP_REQUIRED' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.audit_events a
      WHERE a.action = 'account.admin_promoted' AND a."subjectType" = 'User' AND a."subjectId" = NEW.id
        AND a.metadata->>'targetId' = NEW.id AND a.metadata->>'actorId' = a."actorUserId"
        AND a.metadata->>'bootstrapFingerprint' = bootstrap_fp AND a.metadata->>'databaseIdentity' = instance_id
        AND a.metadata->>'fromRole' IN ('ASSISTANTE', 'COACH') AND a.metadata->>'role' = 'ADMIN'
    ) THEN RAISE EXCEPTION 'UNATTESTED_ADMIN_STATE' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER core_existing_admin_remains_attested AFTER UPDATE ON public.users
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.role = 'ADMIN' AND NEW.role <> 'ADMIN')
  EXECUTE FUNCTION public.core_admin_bootstrap_integrity();

CREATE FUNCTION public.core_promote_admin(actor_id TEXT, target_id TEXT, command_id UUID, reason_code TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE bootstrap_fp TEXT; instance_id TEXT; from_role TEXT; receipt_id TEXT; prior public.audit_events%ROWTYPE;
BEGIN
  IF reason_code IS NULL OR command_id IS NULL OR reason_code !~ '^[A-Z][A-Z0-9_]{4,79}$' THEN
    RAISE EXCEPTION 'PROMOTION_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(4242, 1026);
  PERFORM id FROM public.users WHERE id IN (actor_id, target_id) ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = actor_id AND role = 'ADMIN' AND "accountStatus" = 'ACTIVE' AND password IS NULL) THEN
    RAISE EXCEPTION 'PROMOTION_NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;
  SELECT b.fingerprint, d."instanceId"::text INTO bootstrap_fp, instance_id
    FROM public.core_admin_bootstrap b CROSS JOIN public.core_v2_database_identity d WHERE b.id = 1 AND d.id = 1;
  IF bootstrap_fp IS NULL THEN RAISE EXCEPTION 'BOOTSTRAP_REQUIRED' USING ERRCODE = '23514'; END IF;
  SELECT * INTO prior FROM public.audit_events WHERE action = 'account.admin_promoted' AND metadata->>'commandId' = command_id::text;
  IF FOUND THEN
    IF prior."actorUserId" <> actor_id OR prior."subjectId" <> target_id OR prior.metadata->>'reason' <> reason_code THEN
      RAISE EXCEPTION 'PROMOTION_COMMAND_REPLAY' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = target_id AND role = 'ADMIN' AND password IS NULL) THEN
      RAISE EXCEPTION 'UNATTESTED_ADMIN_STATE' USING ERRCODE = '23514';
    END IF;
    RETURN prior.id;
  END IF;
  SELECT role::text INTO from_role FROM public.users WHERE id = target_id AND "accountStatus" = 'ACTIVE' AND password IS NULL;
  IF from_role IS NULL OR from_role NOT IN ('ASSISTANTE', 'COACH') THEN RAISE EXCEPTION 'PROMOTION_TARGET_INVALID' USING ERRCODE = '23514'; END IF;
  receipt_id := pg_catalog.gen_random_uuid()::text;
  INSERT INTO public.audit_events (id, "actorUserId", action, "subjectType", "subjectId", "correlationId", metadata, "createdAt")
    VALUES (receipt_id, actor_id, 'account.admin_promoted', 'User', target_id, command_id::text,
      jsonb_build_object('actorId', actor_id, 'targetId', target_id, 'commandId', command_id::text,
        'fromRole', from_role, 'role', 'ADMIN', 'reason', reason_code,
        'bootstrapFingerprint', bootstrap_fp, 'databaseIdentity', instance_id), CURRENT_TIMESTAMP);
  UPDATE public.users SET role = 'ADMIN', "sessionVersion" = "sessionVersion" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = target_id;
  RETURN receipt_id;
END;
$$;
REVOKE ALL ON FUNCTION public.core_promote_admin(TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
