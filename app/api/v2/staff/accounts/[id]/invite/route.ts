export const dynamic = 'force-dynamic';

import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { inviteAccount } from '@/lib/core-v2/services';
import { assertAccountEmailHandoffRuntimeConfiguration, kickAccountEmailHandoffDrain } from '@/lib/core-v2/accounts/email-handoff-scheduler';

/** Commits a recoverable encrypted invitation intent; no proof reaches the API client. */
export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    assertAccountEmailHandoffRuntimeConfiguration();
    const issued = await inviteAccount(client, ctx, params.id);
    const user = await client.user.findUniqueOrThrow({ where: { id: params.id } });
    kickAccountEmailHandoffDrain();
    return {
      status: 201,
      data: { user: publicUser(user), invitation: { id: issued.invitation.id, expiresAt: issued.invitation.expiresAt, deliveryStatus: 'QUEUED' } },
    };
  },
});
