export const dynamic = 'force-dynamic';

import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { requestAccountInvitation } from '@/lib/core-v2/services';
import { kickAccountEmailHandoffDrain } from '@/lib/core-v2/accounts/email-handoff-scheduler';
import { assertAccountInvitationRuntimeConfiguration } from '@/lib/core-v2/accounts/invitation-runtime';
import { assertCapability } from '@/lib/core-v2/rbac';

/** Commits a recoverable invitation intent; no proof reaches the API client. */
export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    // L'AUTORISATION PRECEDE la verification de disponibilite de la remise :
    // sinon une CoreV2ConfigError produit un 503 pour un appelant qui doit
    // recevoir 403 (contrat HTTP canonique). Le service reverifie la capacite :
    // defense en profondeur, l'autorite reste le service.
    assertCapability(ctx.actor, 'ACCOUNT_INVITE');
    const issued = await requestAccountInvitation(client, ctx, params.id, { onAuthorized: assertAccountInvitationRuntimeConfiguration });
    const user = issued.user ?? publicUser(await client.user.findUniqueOrThrow({ where: { id: params.id } }));
    kickAccountEmailHandoffDrain();
    return {
      status: 201,
      data: { user, invitation: { id: issued.invitation.id, expiresAt: issued.invitation.expiresAt, deliveryStatus: 'QUEUED' } },
    };
  },
});
