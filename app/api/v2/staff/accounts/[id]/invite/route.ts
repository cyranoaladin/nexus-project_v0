export const dynamic = 'force-dynamic';

import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { inviteAccount } from '@/lib/core-v2/services';
import { deliverCoreV2Invitation } from '@/lib/email/core-v2-invitation';

/** Issues an invitation and hands the raw token to the canonical outbox — it never reaches the API client. */
export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    const issued = await inviteAccount(client, ctx, params.id);
    const user = await client.user.findUniqueOrThrow({ where: { id: params.id } });
    await deliverCoreV2Invitation({
      userId: user.id,
      role: user.role,
      email: issued.email,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      rawToken: issued.rawToken,
      tokenHash: issued.invitation.tokenHash,
      expiresAt: issued.invitation.expiresAt,
    });
    return {
      status: 201,
      data: { user: publicUser(user), invitation: { id: issued.invitation.id, expiresAt: issued.invitation.expiresAt } },
    };
  },
});
