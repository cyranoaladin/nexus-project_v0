export const dynamic = 'force-dynamic';

import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { resendInvitation } from '@/lib/core-v2/services';
import { assertAccountEmailHandoffRuntimeConfiguration, kickAccountEmailHandoffDrain } from '@/lib/core-v2/accounts/email-handoff-scheduler';

export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params, request }) => {
    assertAccountEmailHandoffRuntimeConfiguration();
    const issued = await resendInvitation(client, ctx, params.id, { commandId: request.headers.get('idempotency-key') ?? undefined });
    const user = await client.user.findUniqueOrThrow({ where: { id: params.id } });
    kickAccountEmailHandoffDrain();
    return {
      status: 201,
      data: { user: publicUser(user), invitation: { id: issued.invitation.id, expiresAt: issued.invitation.expiresAt, deliveryStatus: 'QUEUED' } },
    };
  },
});
