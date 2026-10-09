import type { PrismaClient } from '@/core-v2/generated/client';
import { CoreV2ConfigError } from '@/lib/core-v2/config';

const MIGRATION = '0024_core_v2_account_email_handoff';
// Immutable schema SQL checksum; never a credential or account proof.
const MIGRATION_CHECKSUM = 'cdcfe6abfd7a5d4d693ac8b50d8e9d7e67765820d82081586ba86f157a8af388';

const STRICT_MIGRATION = '0025_core_v2_account_email_payload_fail_closed';
const STRICT_MIGRATION_CHECKSUM = 'd4f1a65b6db22fcbd1af8baad2cd089b77539fa23ff9ca60226202751c4fa52a';

export async function assertAccountEmailHandoffSchema(client: Pick<PrismaClient, '$queryRaw'>): Promise<void> {
  let ready = false;
  try {
    const rows = await client.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION}
          AND checksum = ${MIGRATION_CHECKSUM} AND finished_at IS NOT NULL AND rolled_back_at IS NULL
      ) AND EXISTS (
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${STRICT_MIGRATION}
          AND checksum = ${STRICT_MIGRATION_CHECKSUM} AND finished_at IS NOT NULL AND rolled_back_at IS NULL
      ) AND EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'CoreV2JobType' AND e.enumlabel = 'ACCOUNT_EMAIL_HANDOFF'
      ) AND EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'core_v2_job_outbox'::regclass
          AND conname = 'core_v2_job_outbox_payload_check' AND convalidated
          AND pg_get_constraintdef(oid) LIKE '%account-email-handoff/v1%'
          AND lower(pg_get_constraintdef(oid)) LIKE '%coalesce%'
      ) AS ready`;
    ready = rows[0]?.ready === true;
  } catch {
    throw new CoreV2ConfigError('ACCOUNT_EMAIL_HANDOFF_SCHEMA_UNAVAILABLE');
  }
  if (!ready) throw new CoreV2ConfigError('ACCOUNT_EMAIL_HANDOFF_SCHEMA_UNAVAILABLE');
}
