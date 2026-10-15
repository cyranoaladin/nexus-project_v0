-- Close the unbound primitive. Only the application session authorizer can
-- append a command receipt; a different NOLOGIN role can consume it in the
-- SAME transaction. The function owner cannot create receipts or log in.
CREATE OR REPLACE FUNCTION public.core_promote_admin(actor_id TEXT, target_id TEXT, command_id UUID, reason_code TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'SESSION_AUTHORIZED_PROMOTION_REQUIRED' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.core_promote_admin(TEXT, TEXT, UUID, TEXT) FROM PUBLIC;

CREATE UNIQUE INDEX audit_events_admin_promotion_target_key
  ON public.audit_events ("subjectId") WHERE action = 'account.admin_promoted';

CREATE OR REPLACE FUNCTION public.core_reserved_admin_receipt_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE issuer public.users%ROWTYPE; target public.users%ROWTYPE;
  bootstrap_fp TEXT; instance_id TEXT; deadline TIMESTAMPTZ;
BEGIN
  -- Superuser exceptions exist only for the privileged migrator/disposable
  -- corruption tests. No runtime, bootstrap or authorizer has this privilege.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolsuper) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.action IN ('account.admin_promoted', 'account.bootstrap_v1_admin') THEN
    RAISE EXCEPTION 'ADMIN_RECEIPT_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.action IN ('account.admin_promoted', 'account.bootstrap_v1_admin') AND TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'RESERVED_ADMIN_RECEIPT' USING ERRCODE = '42501';
  END IF;
  IF NEW.action = 'account.bootstrap_v1_admin' AND current_user <> 'nexus_core_bootstrap' THEN
    RAISE EXCEPTION 'RESERVED_BOOTSTRAP_RECEIPT' USING ERRCODE = '42501';
  END IF;
  IF NEW.action <> 'account.admin_promoted' THEN RETURN NEW; END IF;
  IF current_user <> 'nexus_core_admin_authorizer' THEN
    RAISE EXCEPTION 'SESSION_AUTHORIZED_PROMOTION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(4242, 1026);
  PERFORM id FROM public.users WHERE id IN (NEW."actorUserId", NEW."subjectId") ORDER BY id FOR UPDATE;
  SELECT * INTO issuer FROM public.users WHERE id = NEW."actorUserId";
  SELECT * INTO target FROM public.users WHERE id = NEW."subjectId";
  SELECT b.fingerprint, d."instanceId"::text INTO bootstrap_fp, instance_id
    FROM public.core_admin_bootstrap b CROSS JOIN public.core_v2_database_identity d WHERE b.id = 1 AND d.id = 1;
  deadline := (NEW.metadata->>'expiresAt')::timestamptz;
  IF issuer.id IS NULL OR issuer.role <> 'ADMIN' OR issuer."accountStatus" <> 'ACTIVE' OR issuer.password IS NOT NULL
    OR target.id IS NULL OR target.id = issuer.id OR target.role NOT IN ('ASSISTANTE', 'COACH')
    OR target."accountStatus" <> 'ACTIVE' OR target.password IS NOT NULL OR bootstrap_fp IS NULL
    OR NEW."subjectType" <> 'User' OR NEW."correlationId" IS NULL
    OR NEW."correlationId" !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    OR NEW.metadata->>'operation' IS DISTINCT FROM 'CORE_ADMIN_PROMOTION'
    OR NEW.metadata->>'reason' IS NULL OR NEW.metadata->>'reason' !~ '^[A-Z][A-Z0-9_]{4,79}$'
    OR NEW.metadata->>'releaseSha' IS NULL OR NEW.metadata->>'releaseSha' !~ '^[a-f0-9]{40}$'
    OR NEW.metadata->>'issuerV1Role' IS NULL OR NEW.metadata->>'issuerV1Role' NOT IN ('ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE')
    OR NEW.metadata->>'issuerV1Version' IS NULL OR NEW.metadata->>'issuerV1Version' !~ '^[0-9]+$'
    OR deadline IS NULL OR deadline <= clock_timestamp() THEN
    RAISE EXCEPTION 'PROMOTION_NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;
  -- Core authority, transaction identity and deadline are derived here, never
  -- trusted from JSON. V1 role/version originate from the leased private JWT.
  NEW.metadata := jsonb_build_object('operation', 'CORE_ADMIN_PROMOTION',
    'actorId', issuer.id, 'targetId', target.id, 'commandId', NEW."correlationId",
    'fromRole', target.role, 'role', 'ADMIN', 'reason', NEW.metadata->>'reason',
    'bootstrapFingerprint', bootstrap_fp, 'databaseIdentity', instance_id,
    'issuerCoreVersion', issuer."invitationScopeVersion", 'targetCoreVersion', target."invitationScopeVersion",
    'targetCoreSessionVersion', target."sessionVersion", 'issuerV1Role', NEW.metadata->>'issuerV1Role',
    'issuerV1Version', (NEW.metadata->>'issuerV1Version')::bigint,
    'releaseSha', NEW.metadata->>'releaseSha', 'authorizationTxid', pg_catalog.txid_current()::text,
    'expiresAt', LEAST(deadline, clock_timestamp() + interval '5 seconds'));
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.core_promote_admin(command_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE command public.audit_events%ROWTYPE; issuer public.users%ROWTYPE; target public.users%ROWTYPE;
  bootstrap_fp TEXT; instance_id TEXT;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(4242, 1026);
  SELECT * INTO command FROM public.audit_events WHERE action = 'account.admin_promoted'
    AND "correlationId" = command_id::text AND metadata->>'commandId' = command_id::text;
  IF command.id IS NULL OR command.metadata->>'operation' IS DISTINCT FROM 'CORE_ADMIN_PROMOTION'
    OR command.metadata->>'authorizationTxid' IS DISTINCT FROM pg_catalog.txid_current()::text
    OR command.metadata->>'expiresAt' IS NULL
    OR (command.metadata->>'expiresAt')::timestamptz <= clock_timestamp() THEN
    RAISE EXCEPTION 'SESSION_AUTHORIZED_PROMOTION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM id FROM public.users WHERE id IN (command."actorUserId", command."subjectId") ORDER BY id FOR UPDATE;
  SELECT * INTO issuer FROM public.users WHERE id = command."actorUserId";
  SELECT * INTO target FROM public.users WHERE id = command."subjectId";
  SELECT b.fingerprint, d."instanceId"::text INTO bootstrap_fp, instance_id
    FROM public.core_admin_bootstrap b CROSS JOIN public.core_v2_database_identity d WHERE b.id = 1 AND d.id = 1;
  IF issuer.id IS NULL OR issuer.role <> 'ADMIN' OR issuer."accountStatus" <> 'ACTIVE' OR issuer.password IS NOT NULL
    OR issuer."invitationScopeVersion"::text IS DISTINCT FROM command.metadata->>'issuerCoreVersion'
    OR bootstrap_fp IS DISTINCT FROM command.metadata->>'bootstrapFingerprint'
    OR instance_id IS DISTINCT FROM command.metadata->>'databaseIdentity'
    OR target.id IS NULL OR target.password IS NOT NULL OR target."accountStatus" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'PROMOTION_NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;
  IF target.role = 'ADMIN' AND target."sessionVersion" = (command.metadata->>'targetCoreSessionVersion')::integer + 1 THEN
    RETURN command.id;
  END IF;
  IF target.role::text IS DISTINCT FROM command.metadata->>'fromRole'
    OR target.role NOT IN ('ASSISTANTE', 'COACH')
    OR target."invitationScopeVersion"::text IS DISTINCT FROM command.metadata->>'targetCoreVersion'
    OR target."sessionVersion" <> (command.metadata->>'targetCoreSessionVersion')::integer THEN
    RAISE EXCEPTION 'PROMOTION_TARGET_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  UPDATE public.users SET role = 'ADMIN', "sessionVersion" = "sessionVersion" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = target.id;
  RETURN command.id;
END;
$$;
REVOKE ALL ON FUNCTION public.core_promote_admin(UUID) FROM PUBLIC;

CREATE FUNCTION public.core_reserved_admin_receipt_commit() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.action = 'account.bootstrap_v1_admin' THEN
    IF NOT EXISTS (SELECT 1 FROM public.core_admin_bootstrap b JOIN public.users u ON u.id = b."v1UserId"
      JOIN public.core_v2_database_identity d ON d.id = 1
      WHERE b.id = 1 AND b."receiptId" = NEW.id AND u.role = 'ADMIN' AND u.password IS NULL
        AND NEW."subjectType" = 'User' AND NEW."actorUserId" = u.id AND NEW."subjectId" = u.id
        AND NEW."correlationId" = b.nonce AND NEW.metadata = b.manifest
        AND b.manifest->>'databaseIdentity' = d."instanceId"::text)
      OR (SELECT count(*) FROM public.audit_events WHERE action = 'account.bootstrap_v1_admin') <> 1 THEN
      RAISE EXCEPTION 'UNATTESTED_ADMIN_STATE' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.action <> 'account.admin_promoted' THEN RETURN NULL; END IF;
  IF NEW.metadata->>'operation' IS DISTINCT FROM 'CORE_ADMIN_PROMOTION'
    OR NEW.metadata->>'authorizationTxid' IS DISTINCT FROM pg_catalog.txid_current()::text
    OR NEW.metadata->>'expiresAt' IS NULL OR NEW.metadata->>'targetCoreSessionVersion' IS NULL
    OR (NEW.metadata->>'expiresAt')::timestamptz <= clock_timestamp()
    OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW."subjectId" AND role = 'ADMIN' AND password IS NULL
      AND "sessionVersion" = (NEW.metadata->>'targetCoreSessionVersion')::integer + 1) THEN
    RAISE EXCEPTION 'UNATTESTED_ADMIN_STATE' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER core_reserved_admin_receipt_commit AFTER INSERT ON public.audit_events
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.core_reserved_admin_receipt_commit();
