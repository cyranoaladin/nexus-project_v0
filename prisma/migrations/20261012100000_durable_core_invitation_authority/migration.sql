-- Additive V1 authority: retain generation proofs independently of mail retention.
CREATE TABLE public.v1_account_invitation_issuances (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  generation INTEGER NOT NULL CHECK (generation > 0),
  "databaseIdentity" UUID NOT NULL,
  "bindingDigest" TEXT NOT NULL CHECK ("bindingDigest" ~ '^[a-f0-9]{64}$'),
  "issuerId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "issuerVersion" INTEGER NOT NULL CHECK ("issuerVersion" >= 0),
  "recipientDigest" TEXT NOT NULL CHECK ("recipientDigest" ~ '^[a-f0-9]{64}$'),
  "targetRole" public."UserRole" NOT NULL CHECK ("targetRole" <> 'ADMIN'),
  operation TEXT NOT NULL CHECK (operation IN ('INVITE', 'RESEND')),
  outcome TEXT NOT NULL CHECK (outcome IN ('INVITED', 'ACTIVE_LINKED')),
  "activationTokenHash" TEXT,
  "expiresAt" TIMESTAMP(3),
  "outboxId" TEXT UNIQUE,
  "revokedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", generation),
  CHECK ((outcome = 'INVITED' AND "activationTokenHash" IS NOT NULL AND "expiresAt" IS NOT NULL AND "outboxId" IS NOT NULL)
    OR (outcome = 'ACTIVE_LINKED' AND "activationTokenHash" IS NULL AND "expiresAt" IS NULL AND "outboxId" IS NULL))
);
REVOKE ALL ON public.v1_account_invitation_issuances FROM PUBLIC;

CREATE FUNCTION public.v1_invitation_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'V1_INVITATION_RECEIPT_IMMUTABLE'; END IF;
  IF (to_jsonb(OLD) - 'revokedAt' - 'deliveredAt') IS DISTINCT FROM (to_jsonb(NEW) - 'revokedAt' - 'deliveredAt')
    OR (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt")
    OR (OLD."deliveredAt" IS NOT NULL AND NEW."deliveredAt" IS DISTINCT FROM OLD."deliveredAt") THEN
    RAISE EXCEPTION 'V1_INVITATION_RECEIPT_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER v1_invitation_receipt_immutable BEFORE UPDATE OR DELETE
ON public.v1_account_invitation_issuances FOR EACH ROW EXECUTE FUNCTION public.v1_invitation_receipt_immutable();

-- All authority changes, including direct SQL ABA transitions, invalidate captured sessions.
CREATE FUNCTION public.v1_identity_authority_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF ROW(NEW.role, NEW.email, NEW.password, NEW."activatedAt", NEW."disabledAt", NEW."mergedIntoUserId")
    IS DISTINCT FROM ROW(OLD.role, OLD.email, OLD.password, OLD."activatedAt", OLD."disabledAt", OLD."mergedIntoUserId") THEN
    NEW."sessionVersion" := GREATEST(NEW."sessionVersion", OLD."sessionVersion" + 1);
  ELSE
    NEW."sessionVersion" := GREATEST(NEW."sessionVersion", OLD."sessionVersion");
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER v1_identity_authority_version BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.v1_identity_authority_version();
