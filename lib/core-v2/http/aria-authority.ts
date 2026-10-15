import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { AriaAuthorityRevokedError } from '@/lib/aria/kernel/errors';
import { withCoreV2AriaActor } from '@/lib/core-v2/aria/conversation-authority';
import { assertSelfServiceRole } from '@/lib/core-v2/rbac';
import type { Tx, ServiceContext } from '@/lib/core-v2/services/context';
import type { RouteArgs, RouteResult } from './staff-route';
import { ok, privateResponse } from './respond';

/** Serialize the owned projection under the same transaction and V1 lease. */
export async function withCoreV2AriaResponse(
  args: Pick<RouteArgs<unknown, unknown>, 'client' | 'ctx' | 'request' | 'session'>,
  operation: (client: Tx, ctx: ServiceContext) => Promise<RouteResult>,
) {
  assertSelfServiceRole(args.ctx.actor, 'ELEVE');
  const claims = await readBoundPrivateV1Session(args.request, args.session);
  if (!claims) throw new AriaAuthorityRevokedError();
  return withCoreV2AriaActor(args.client, claims, args.ctx, async (client, ctx) => {
    const result = await operation(client, ctx);
    return privateResponse(ok(result.data, ctx.correlationId, result.status));
  });
}
