export const dynamic = 'force-dynamic';

import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { requestAccountInvitationResend } from '@/lib/core-v2/services';
import { kickAccountEmailHandoffDrain } from '@/lib/core-v2/accounts/email-handoff-scheduler';
import { assertAccountInvitationRuntimeConfiguration } from '@/lib/core-v2/accounts/invitation-runtime';
import { assertCapability } from '@/lib/core-v2/rbac';

export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params, request }) => {
    // Meme ordre que /invite : capacite d'abord, disponibilite de la remise
    // ensuite, pour ne jamais rendre 503 a un appelant qui doit recevoir 403.
    assertCapability(ctx.actor, 'ACCOUNT_INVITE');
    assertAccountInvitationRuntimeConfiguration();
    const issued = await requestAccountInvitationResend(client, ctx, params.id, { commandId: request.headers.get('idempotency-key') ?? undefined });
    const user = await client.user.findUniqueOrThrow({ where: { id: params.id } });
    kickAccountEmailHandoffDrain();
    return {
      status: 201,
      data: { user: publicUser(user), invitation: { id: issued.invitation.id, expiresAt: issued.invitation.expiresAt, deliveryStatus: 'QUEUED' } },
    };
  },
});
