-- Personal-code credentials are V1 authority changes, including direct SQL ABA.
CREATE OR REPLACE FUNCTION public.v1_identity_authority_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF ROW(NEW.role, NEW.email, NEW.password, NEW."pinHash", NEW."activatedAt", NEW."disabledAt", NEW."mergedIntoUserId")
    IS DISTINCT FROM ROW(OLD.role, OLD.email, OLD.password, OLD."pinHash", OLD."activatedAt", OLD."disabledAt", OLD."mergedIntoUserId") THEN
    NEW."sessionVersion" := GREATEST(NEW."sessionVersion", OLD."sessionVersion" + 1);
  ELSE
    NEW."sessionVersion" := GREATEST(NEW."sessionVersion", OLD."sessionVersion");
  END IF;
  RETURN NEW;
END $$;
