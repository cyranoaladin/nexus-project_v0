import { prisma } from '@/lib/prisma';

const MIGRATION = '20261012100000_durable_core_invitation_authority';
const CHECKSUM = 'ae56cdcc79d606a59d2ea86712bb805c7f68529a148ba97b015059ee8dc09509';
const PERSONAL_CODE_MIGRATION = '20261012190000_personal_code_authority_version';
const PERSONAL_CODE_CHECKSUM = '9837eb9ee65eb2dcadd40380dcb6f4ecdb37eec45ec060aafe633bc2f39e29e3';
/** Startup proof for the sole credential authority, not an inferred model version. */
export async function assertV1InvitationAuthoritySchema(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = ${MIGRATION}
        AND checksum = ${CHECKSUM} AND finished_at IS NOT NULL AND rolled_back_at IS NULL)
      AND EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = ${PERSONAL_CODE_MIGRATION}
        AND checksum = ${PERSONAL_CODE_CHECKSUM} AND finished_at IS NOT NULL AND rolled_back_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)
      AND to_regclass('public.v1_account_invitation_issuances') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.users'::regclass
        AND tgname = 'v1_identity_authority_version' AND tgenabled = 'O'
        AND tgfoid = 'public.v1_identity_authority_version()'::regprocedure)
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.v1_account_invitation_issuances'::regclass
        AND tgname = 'v1_invitation_receipt_immutable' AND tgenabled = 'O'
        AND tgfoid = 'public.v1_invitation_receipt_immutable()'::regprocedure) AS ready`;
    if (rows[0]?.ready !== true) throw new Error('V1_INVITATION_AUTHORITY_SCHEMA_UNAVAILABLE');
  } catch { throw new Error('V1_INVITATION_AUTHORITY_SCHEMA_UNAVAILABLE'); }
}
