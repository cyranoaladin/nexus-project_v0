export const dynamic = 'force-dynamic';

import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { inviteAccount } from '@/lib/core-v2/services';
import { assertAccountEmailHandoffRuntimeConfiguration, kickAccountEmailHandoffDrain } from '@/lib/core-v2/accounts/email-handoff-scheduler';
import { assertCapability } from '@/lib/core-v2/rbac';

/** Commits a recoverable encrypted invitation intent; no proof reaches the API client. */
export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    // L'AUTORISATION PRECEDE la configuration de remise : sinon une
    // CoreV2ConfigError produit un 503 pour un appelant qui doit recevoir 403
    // (contrat HTTP canonique). inviteAccount reverifie la capacite : defense
    // en profondeur, l'autorite reste le service.
    assertCapability(ctx.actor, 'ACCOUNT_INVITE');
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
