-- Keep the expression-index function resolvable for PostgreSQL maintenance
-- workers, whose search_path does not necessarily include the public schema.
-- The original migration is already deployed, so this is an additive
-- CREATE OR REPLACE correction with identical normalization semantics.
CREATE OR REPLACE FUNCTION public.nexus_household_name_key(first_name text, last_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.nexus_normalize_name_part(first_name)
      || E'\t'
      || public.nexus_normalize_name_part(last_name)
$$;
