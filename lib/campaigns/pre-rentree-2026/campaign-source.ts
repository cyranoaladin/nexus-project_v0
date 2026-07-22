import 'server-only';

import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import { PreRentreeCampaignManifestSchema } from './schema';
import type { PreRentreeCampaignManifest } from './schema';

/** Validated low-level campaign source shared by internal and public adapters. */
export function getPreRentreeCampaign(): PreRentreeCampaignManifest {
  return PreRentreeCampaignManifestSchema.parse(campaignManifest);
}
