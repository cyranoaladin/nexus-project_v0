-- ARIA rights and course choices share the same pre-row authority mutex.
-- Random versions close revoke/regrant and course delete/recreate ABA races.
ALTER TABLE public.student_course_enrollments ADD COLUMN "invitationScopeVersion" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.aria_access_grants_core_v2 ADD COLUMN "invitationScopeVersion" UUID NOT NULL DEFAULT gen_random_uuid();
DO $$ DECLARE name TEXT; BEGIN
  FOREACH name IN ARRAY ARRAY['student_course_enrollments', 'aria_access_grants_core_v2'] LOOP
    EXECUTE format('CREATE TRIGGER core_invitation_authority_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.core_invitation_authority_lock()', name);
    EXECUTE format('CREATE TRIGGER core_invitation_scope_version BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.core_invitation_scope_version()', name);
  END LOOP;
END; $$;
