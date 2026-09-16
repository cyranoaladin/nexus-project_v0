/**
 * Session -> Core v2 actor mapping (§S/§V explicit authority mapping).
 *
 * The signed-in identity still comes from the live NextAuth session (Core v1
 * credentials) until the auth cutover. Core v2 is nevertheless the ONLY
 * authority for what that identity may do here: the actor's role and
 * account state are read from the Core v2 `users` row with the same id
 * (stable ids are preserved by the migrator). No row = not a Core v2 actor
 * = refused. The session's own role claim is deliberately ignored — there is
 * no "fall back to the v1 role" path.
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import { ForbiddenError } from '../errors';
import type { Actor } from '../rbac';

export async function resolveActor(client: PrismaClient, sessionUserId: string): Promise<Actor> {
  const user = await client.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, role: true, accountStatus: true },
  });
  if (!user) {
    throw new ForbiddenError('This account is not a Core v2 actor.', { code: 'ACTOR_NOT_IN_CORE_V2' });
  }
  if (user.accountStatus !== 'ACTIVE') {
    throw new ForbiddenError('This account is not active in Core v2.', {
      code: 'ACTOR_NOT_ACTIVE',
      accountStatus: user.accountStatus,
    });
  }
  return { userId: user.id, role: user.role };
}
