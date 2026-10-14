import type { PrismaClient } from '@/core-v2/generated/client';
import { CoreV2ConfigError } from '@/lib/core-v2/config';
import { assertBootstrapSchema } from './bootstrap-schema';

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
    await assertBootstrapSchema(client);
    const rows = await client.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${V1_PROVISIONING_MIGRATION}
          AND checksum = ${MIGRATION_CHECKSUM} AND finished_at IS NOT NULL AND rolled_back_at IS NULL
      ) AND EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'CoreV2JobType' AND e.enumlabel = 'ACCOUNT_V1_PROVISIONING'
      ) AND to_regclass('account_v1_provisioning') IS NOT NULL
      AND EXISTS (SELECT 1 FROM public._prisma_migrations
        WHERE migration_name = '0030_core_v2_invitation_authority'
          AND checksum = 'cec284ad3b0af391c25417d16bcd68f9ec704d761c8167fc8e6492fe7ea16729'
          AND finished_at IS NOT NULL AND rolled_back_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)
      AND to_regclass('public.invitation_scope_grants') IS NOT NULL
      AND (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgname = 'core_invitation_authority_lock'
        AND tgenabled = 'O' AND tgrelid IN ('public.users'::regclass, 'public.household_parents'::regclass,
          'public.students_v2'::regclass, 'public.academic_years'::regclass,
          'public.student_academic_year_enrollments'::regclass, 'public.invitation_scope_grants'::regclass,
          'public.account_v1_provisioning'::regclass)) = 7
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.account_v1_provisioning'::regclass
        AND tgname = 'core_invitation_binding_immutable' AND tgenabled = 'O')
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
