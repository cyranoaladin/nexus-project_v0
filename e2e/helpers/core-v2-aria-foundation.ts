import { PrismaClient } from '../../core-v2/generated/client';
import { resetCoreV2AriaFoundationProfile as resetSeededProfile } from '../../scripts/core-v2/aria-foundation-e2e-persona';
import { assertCoreV2E2eSeedTarget } from '../../scripts/core-v2/e2e-seed-target';

/**
 * Re-establish the seed's empty onboarding state before the Core v2 browser
 * journey. This makes reruns on the same disposable lane independent of the
 * prior run's persisted pins and onboarding completion.
 */
export async function resetCoreV2AriaFoundationProfile(): Promise<void> {
  assertCoreV2E2eSeedTarget(process.env);
  const client = new PrismaClient({
    datasources: { db: { url: process.env.CORE_V2_DATABASE_URL } },
  });
  try {
    await resetSeededProfile(client);
  } finally {
    await client.$disconnect();
  }
}
