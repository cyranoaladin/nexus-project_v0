-- Run only by the privileged Core provisioner, after additive migrations.
-- LOGIN passwords/connect privileges are installed separately from 0600 files.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexus_core_admin_promoter_owner') THEN
    CREATE ROLE nexus_core_admin_promoter_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexus_core_admin_promotion') THEN
    CREATE ROLE nexus_core_admin_promotion NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexus_core_admin_authorizer') THEN
    CREATE ROLE nexus_core_admin_authorizer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
ALTER ROLE nexus_core_admin_promoter_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
ALTER ROLE nexus_core_admin_promotion NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
ALTER ROLE nexus_core_admin_authorizer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM nexus_core_admin_promoter_owner, nexus_core_admin_promotion, nexus_core_admin_authorizer;
GRANT USAGE ON SCHEMA public TO nexus_core_admin_promoter_owner, nexus_core_admin_promotion, nexus_core_admin_authorizer;
GRANT SELECT ON public.users, public.audit_events, public.core_admin_bootstrap, public.core_v2_database_identity
  TO nexus_core_admin_promoter_owner;
GRANT SELECT ON public.users, public.audit_events, public.core_admin_bootstrap, public.core_v2_database_identity,
  public._prisma_migrations TO nexus_core_admin_authorizer;
GRANT UPDATE (role, "sessionVersion", "updatedAt") ON public.users TO nexus_core_admin_promoter_owner;
-- PostgreSQL row locks require UPDATE on at least one column. Role-changing
-- triggers still deny every authorizer write to ADMIN role/credential fields.
GRANT UPDATE ("updatedAt") ON public.users TO nexus_core_admin_authorizer;
GRANT INSERT (id, "actorUserId", action, "subjectType", "subjectId", "correlationId", metadata, "createdAt")
  ON public.audit_events TO nexus_core_admin_authorizer;
ALTER FUNCTION public.core_promote_admin(UUID) OWNER TO nexus_core_admin_promoter_owner;
REVOKE ALL ON FUNCTION public.core_promote_admin(UUID) FROM PUBLIC, nexus_core_admin_authorizer;
REVOKE ALL ON FUNCTION public.core_promote_admin(TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, nexus_core_admin_promotion, nexus_core_admin_authorizer;
GRANT EXECUTE ON FUNCTION public.core_promote_admin(UUID) TO nexus_core_admin_promotion;
GRANT nexus_core_admin_promotion TO nexus_core_admin_authorizer;
REVOKE nexus_core_admin_promoter_owner FROM nexus_core_admin_promotion, nexus_core_admin_authorizer;
