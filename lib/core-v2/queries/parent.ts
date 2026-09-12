/**
 * Parent read model (go-live §AH): a parent sees exactly ONE household — the
 * one their account belongs to — resolved from the actor's identity, never
 * from a client-supplied id. There is no household parameter anywhere on this
 * path, so "another family's data" is unreachable by construction (negative
 * proof in __tests__/core-v2/http/parent-api.test.ts).
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import { assertSelfServiceRole } from '../rbac';
import type { ServiceContext } from '../services/context';
import { loadHouseholdDetail } from './staff';

export type OwnHousehold = NonNullable<Awaited<ReturnType<typeof loadHouseholdDetail>>>;

export async function getOwnHousehold(client: PrismaClient, ctx: ServiceContext): Promise<OwnHousehold | null> {
  assertSelfServiceRole(ctx.actor, 'PARENT');
  const membership = await client.householdParent.findUnique({
    where: { userId: ctx.actor.userId },
    select: { householdId: true },
  });
  if (!membership) return null;
  return loadHouseholdDetail(client, membership.householdId);
}
