-- Shared authority mutex: bootstrap, sync, invitation, role and scope mutation
-- always acquire this before any row lock. Outbox claims remain independent.
CREATE TABLE public.invitation_scope_grants (
  id TEXT PRIMARY KEY,
  "staffUserId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "householdId" TEXT NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "academicYearId" TEXT NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "grantedById" TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  "invitationScopeVersion" UUID NOT NULL DEFAULT gen_random_uuid(),
  "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "invitation_scope_grants_staffUserId_householdId_academicYearId_key"
  ON public.invitation_scope_grants ("staffUserId", "householdId", "academicYearId");
ALTER TABLE public.account_v1_provisioning ADD COLUMN "invitationBinding" JSONB;
ALTER TABLE public.users ADD COLUMN "invitationScopeVersion" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.household_parents ADD COLUMN "invitationScopeVersion" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.students_v2 ADD COLUMN "invitationScopeVersion" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.academic_years ADD COLUMN "invitationScopeVersion" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.student_academic_year_enrollments ADD COLUMN "invitationScopeVersion" UUID NOT NULL DEFAULT gen_random_uuid();

CREATE FUNCTION public.core_invitation_authority_lock() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(4242, 1026);
  RETURN NULL;
END; $$;
CREATE FUNCTION public.core_invitation_scope_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  -- Rotate on every write, including direct DB writers. Suspend/reactivate,
  -- revoke/regrant and reassign/back never restore an older invitation right.
  NEW."invitationScopeVersion" := pg_catalog.gen_random_uuid();
  RETURN NEW;
END; $$;
DO $$ DECLARE name TEXT; BEGIN
  FOREACH name IN ARRAY ARRAY['users','household_parents','students_v2','academic_years',
    'student_academic_year_enrollments','invitation_scope_grants','account_v1_provisioning'] LOOP
    EXECUTE format('CREATE TRIGGER core_invitation_authority_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.core_invitation_authority_lock()', name);
    IF name <> 'account_v1_provisioning' THEN
      EXECUTE format('CREATE TRIGGER core_invitation_scope_version BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.core_invitation_scope_version()', name);
    END IF;
  END LOOP;
END; $$;

CREATE FUNCTION public.core_invitation_binding_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.generation = OLD.generation AND
    (NEW."invitationBinding" IS DISTINCT FROM OLD."invitationBinding" OR NEW."requestedById" IS DISTINCT FROM OLD."requestedById") THEN
    RAISE EXCEPTION 'INVITATION_BINDING_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER core_invitation_binding_immutable BEFORE UPDATE ON public.account_v1_provisioning
  FOR EACH ROW EXECUTE FUNCTION public.core_invitation_binding_immutable();
