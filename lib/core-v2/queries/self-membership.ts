import { requireCoreV2Client } from '../client';
import type { Actor } from '../rbac';

/** Presentation metadata only. This grants no resource capability. */
export type OwnCoreMembership = { readonly state: 'ACTIVE'; readonly role: Actor['role'] }
  | { readonly state: 'NOT_ENABLED' | 'NOT_MEMBER' | 'INACTIVE' };

/** Only call with the immutable ID from an authenticated V1 session. */
export async function readOwnCoreMembership(sessionUserId: string): Promise<OwnCoreMembership> {
  if (process.env.CORE_V2_DATABASE_URL === undefined) return { state: 'NOT_ENABLED' };
  const client = await requireCoreV2Client();
  const user = await client.user.findUnique({
    where: { id: sessionUserId }, select: { role: true, accountStatus: true },
  });
  if (!user) return { state: 'NOT_MEMBER' };
  if (user.accountStatus !== 'ACTIVE') return { state: 'INACTIVE' };
  return { state: 'ACTIVE', role: user.role };
}
