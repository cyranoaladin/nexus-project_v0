-- Invitation authority of OTHER family members: rotates on every authority change of the
-- account (role, e-mail, any status change incl. suspend→reactivate ABA), but not on the
-- one-way PENDING_ACTIVATION → ACTIVE activation, so a member's own activation never
-- cancels a sibling's pending invitation. Writers cannot choose or restore a value.
ALTER TABLE public.users ADD COLUMN "invitationAuthorityEpoch" UUID NOT NULL DEFAULT gen_random_uuid();

CREATE FUNCTION public.core_invitation_authority_epoch() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."invitationAuthorityEpoch" := pg_catalog.gen_random_uuid();
  ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.email IS DISTINCT FROM OLD.email
    OR (NEW."accountStatus" IS DISTINCT FROM OLD."accountStatus"
      AND NOT (OLD."accountStatus" = 'PENDING_ACTIVATION' AND NEW."accountStatus" = 'ACTIVE')) THEN
    NEW."invitationAuthorityEpoch" := pg_catalog.gen_random_uuid();
  ELSE
    NEW."invitationAuthorityEpoch" := OLD."invitationAuthorityEpoch";
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER core_invitation_authority_epoch BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.core_invitation_authority_epoch();
