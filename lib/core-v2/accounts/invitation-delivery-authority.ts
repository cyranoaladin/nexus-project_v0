import type { PrismaClient } from '@/core-v2/generated/client';
import { assertCurrentInvitationBinding, lockInvitationAuthority } from './invitation-scope';
import { ForbiddenError } from '../errors';
import { InvitationDeliveryRefusal, type AccountInvitationAuthority } from '@/lib/email/account-invitation-authority';

/** Core lock remains held through the V1 identity/receipt/fence check and SMTP acknowledgement. */
export function accountInvitationDeliveryAuthority(client: PrismaClient): AccountInvitationAuthority {
  return async (reference, deliver) => {
    try {
      return await client.$transaction(async tx => {
        await lockInvitationAuthority(tx);
        const saga = await tx.accountV1Provisioning.findUnique({ where: { userId: reference.userId } });
        if (!saga || saga.generation !== reference.generation || !['REQUESTED', 'V1_ISSUE_PENDING', 'SENT'].includes(saga.state))
          throw new InvitationDeliveryRefusal();
        const binding = await assertCurrentInvitationBinding(tx, saga);
        if (binding.v1IssuerVersion === null) throw new InvitationDeliveryRefusal();
        return deliver({ userId: reference.userId, generation: reference.generation,
          issuerId: binding.scope.issuerId, issuerVersion: binding.v1IssuerVersion,
          databaseIdentity: binding.scope.databaseIdentity, bindingDigest: binding.fingerprint,
          operation: binding.scope.operation, recipientDigest: binding.scope.recipientDigest });
      });
    } catch (error) {
      if (error instanceof ForbiddenError) throw new InvitationDeliveryRefusal();
      throw error;
    }
  };
}
