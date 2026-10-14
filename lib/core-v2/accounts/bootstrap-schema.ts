import type { Tx } from '../services/context';
import { InvalidStateError } from '../errors';

/** Runtime attestation of the additive bootstrap protections, before any write. */
export async function assertBootstrapSchema(client: Pick<Tx, '$queryRaw'>): Promise<void> {
  let ready = false;
  try {
    const [row] = await client.$queryRaw<Array<{ ready: boolean }>>`
      SELECT (SELECT count(*) FROM (VALUES
        ('0028_core_v2_exclusive_admin_bootstrap', '8e71f9a765f9a3a3b987cc8d53bd704801358513654f17e292b27f3e4e71908f'), -- ggignore : somme SHA-256 publique de migration
        ('0029_core_v2_attested_admin_promotions', '2b605c19c16e7172217039a05654da4fa0d60e5757aa9b3f27b658bcd510a86a'), -- ggignore : somme SHA-256 publique de migration
        ('0031_core_v2_bootstrap_commit_expiry', 'c29250602470f493f68f13c1d4132b1766eb331ed18f60177c2a60a325b34221'), -- ggignore : somme SHA-256 publique de migration
        ('0032_core_v2_session_authorized_admin_promotion', '4e07cd4fe87da06dd72c936dc1ae99a5af8f865e1d9bbba775877049fe36b692') -- ggignore : somme SHA-256 publique de migration
      ) AS expected(name, checksum) JOIN public._prisma_migrations m ON m.migration_name = expected.name
        AND m.checksum = expected.checksum AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL) = 4
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE t.tgrelid = 'public.audit_events'::regclass
          AND t.tgname = 'core_reserved_admin_receipt_commit' AND t.tgenabled = 'O'
          AND t.tgdeferrable AND t.tginitdeferred AND t.tgtype = 5
          AND n.nspname = 'public' AND p.proname = 'core_reserved_admin_receipt_commit')
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE t.tgrelid = 'public.core_admin_bootstrap'::regclass
          AND t.tgname = 'core_admin_bootstrap_commit_expiry' AND t.tgenabled = 'O'
          AND t.tgdeferrable AND t.tginitdeferred AND t.tgtype = 5
          AND n.nspname = 'public' AND p.proname = 'core_admin_bootstrap_commit_expiry')
      AND (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgenabled = 'O'
        AND tgrelid = 'public.core_admin_bootstrap'::regclass
        AND tgname IN ('core_admin_bootstrap_integrity', 'core_admin_bootstrap_immutable')) = 2
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgenabled = 'O'
        AND tgrelid = 'public.users'::regclass AND tgname = 'core_admin_requires_attestation'
        AND tgdeferrable AND tginitdeferred)
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgenabled = 'O'
        AND tgrelid = 'public.users'::regclass AND tgname = 'core_admin_write_authority')
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgenabled = 'O'
        AND tgrelid = 'public.audit_events'::regclass AND tgname = 'core_reserved_admin_receipt_guard') AS ready`;
    ready = row?.ready === true;
  } catch { throw new InvalidStateError('BOOTSTRAP_SCHEMA_UNAVAILABLE'); }
  if (!ready) throw new InvalidStateError('BOOTSTRAP_SCHEMA_UNAVAILABLE');
}
