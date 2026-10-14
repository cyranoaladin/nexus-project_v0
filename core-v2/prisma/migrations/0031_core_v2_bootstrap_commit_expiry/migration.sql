-- Expiration is checked at COMMIT, not merely before the actor/receipt writes.
-- This applies only to first creation; later administration remains possible
-- after the historical manifest has expired.
CREATE FUNCTION public.core_admin_bootstrap_commit_expiry() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE expires_at TIMESTAMPTZ;
BEGIN
  expires_at := (NEW.manifest->>'expiresAt')::timestamptz;
  IF expires_at IS NULL OR expires_at <= pg_catalog.clock_timestamp() THEN
    RAISE EXCEPTION 'MANIFEST_EXPIRED' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) THEN
    RAISE EXCEPTION 'BOOTSTRAP_MIGRATIONS_INCOMPLETE' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER core_admin_bootstrap_commit_expiry AFTER INSERT ON public.core_admin_bootstrap
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.core_admin_bootstrap_commit_expiry();
