import type { PrismaClient } from '@/core-v2/generated/client';
import { CoreV2ConfigError } from '@/lib/core-v2/config';

export const V1_PROVISIONING_MIGRATION = '0026_core_v2_account_v1_provisioning';
// Immutable schema SQL checksum; never a credential or account proof.
const MIGRATION_CHECKSUM = '21b6bc300f9d38539c627c9d4485c677384e3cdcd01c5ba785d872b6b9bc932a';

/**
 * Fails closed unless the exact additive migration is applied: the saga table,
 * its new job type and the closed non-secret payload constraint. A runtime that
 * cannot prove all three must not accept invitation requests.
 */
export async function assertAccountV1ProvisioningSchema(client: Pick<PrismaClient, '$queryRaw'>): Promise<void> {
  let ready = false;
  try {
    const rows = await client.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${V1_PROVISIONING_MIGRATION}
          AND checksum = ${MIGRATION_CHECKSUM} AND finished_at IS NOT NULL AND rolled_back_at IS NULL
      ) AND EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'CoreV2JobType' AND e.enumlabel = 'ACCOUNT_V1_PROVISIONING'
      ) AND to_regclass('account_v1_provisioning') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'core_v2_job_outbox'::regclass
          AND conname = 'core_v2_job_outbox_payload_check' AND convalidated
          AND pg_get_constraintdef(oid) LIKE '%account-v1-provisioning/v1%'
      ) AS ready`;
    ready = rows[0]?.ready === true;
  } catch {
    throw new CoreV2ConfigError('ACCOUNT_V1_PROVISIONING_SCHEMA_UNAVAILABLE');
  }
  if (!ready) throw new CoreV2ConfigError('ACCOUNT_V1_PROVISIONING_SCHEMA_UNAVAILABLE');
}
