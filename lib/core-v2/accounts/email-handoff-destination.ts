import type { AccountEmailHandoffContent } from '@/lib/email/account-handoff-envelope';
import { deliverCoreV2Invitation } from '@/lib/email/core-v2-invitation';
import { deliverCoreV2PasswordReset } from '@/lib/email/core-v2-password-reset';

/** Destination enqueue only. The provider is drained independently after commit. */
export async function transferAccountEmailHandoff(content: AccountEmailHandoffContent): Promise<void> {
  const common = {
    deferDrain: true, userId: content.userId, email: content.email, displayName: content.displayName,
    rawToken: content.rawToken, expiresAt: new Date(content.expiresAt),
  };
  if (content.purpose === 'ACTIVATION') {
    await deliverCoreV2Invitation({ ...common, role: content.role, invitationId: content.issuanceId });
  } else {
    await deliverCoreV2PasswordReset({ ...common, resetId: content.issuanceId });
  }
}
