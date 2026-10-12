import { getAuthRolloutMode } from '@/lib/core-v2/auth/authority';
import {
  assertAccountEmailHandoffRuntimeConfiguration,
  assertAccountV1ProvisioningRuntimeConfiguration,
} from './email-handoff-scheduler';

/**
 * Availability check run before an invitation request is accepted. Under
 * V1_ONLY it verifies everything the V1 saga needs to finish (Core database,
 * v1 mail outbox key, public origin); in every other mode it is the unchanged
 * Core handoff check. A request is refused up front, never half-started.
 */
export function assertAccountInvitationRuntimeConfiguration(): void {
  if (getAuthRolloutMode() === 'V1_ONLY') assertAccountV1ProvisioningRuntimeConfiguration();
  else assertAccountEmailHandoffRuntimeConfiguration();
}
