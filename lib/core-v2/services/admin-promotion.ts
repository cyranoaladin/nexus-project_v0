import { z } from 'zod';
import type { PrismaClient } from '@/core-v2/generated/client';
import type { AuthSession } from '@/lib/guards';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { acquireV1InvitationIdentity, V1InvitationScopeRefusal, type V1IdentityLease } from '@/lib/auth/v1-invitation-authority';
import { readRunningReleaseSha } from '@/lib/deployment/release-identity';
import { requireCoreV2AdminAuthorizerClient } from '../client';
import { assertBootstrapAttested, lockV1AdminBootstrap } from '../accounts/bootstrap-v1-admin';
import { credentialAuthorityIsV1 } from '../accounts/v1-authority';
import { ForbiddenError, ConflictError, InvalidStateError } from '../errors';
import { assertCapability, subjectHasRole, subjectMatchesActorRole } from '../rbac';
import type { ServiceContext } from './context';
import { idSchema, parseInput } from './validation';

export const adminPromotionInputSchema = z.object({ targetId: idSchema, commandId: z.string().uuid(),
  reason: z.enum(['STAFF_AUTHORIZATION', 'SUCCESSION', 'ACCESS_RECONCILIATION']) }).strict();
function refuse(): never { throw new ForbiddenError('Administrator promotion unavailable.'); }
/** The first ADMIN remains exclusively offline. Later promotions require the
 * private, live V1 session AND the stored Core ADMIN, leased through commit. */
export async function promoteCoreAdministrator(client: PrismaClient, ctx: ServiceContext, session: AuthSession,
  request: Readonly<{ headers: Headers }>, rawInput: unknown) {
  assertCapability(ctx.actor, 'ADMIN_PROMOTE');
  if (!credentialAuthorityIsV1() || session.user.id !== ctx.actor.userId) refuse();
  const privateSession = await readBoundPrivateV1Session(request, session);
  if (!privateSession) refuse();
  const input = parseInput(adminPromotionInputSchema, rawInput);
  const releaseSha = await readRunningReleaseSha();
  if (!releaseSha) throw new InvalidStateError('ADMIN_PROMOTION_RELEASE_UNAVAILABLE');
  const authorizer = await requireCoreV2AdminAuthorizerClient();
  const runtimeIdentity = await client.coreV2DatabaseIdentity.findUniqueOrThrow({ where: { id: 1 } });
  let lease: V1IdentityLease | undefined;
  try {
    return await authorizer.$transaction(async tx => {
      await lockV1AdminBootstrap(tx);
      await assertBootstrapAttested(tx);
      const identity = await tx.coreV2DatabaseIdentity.findUniqueOrThrow({ where: { id: 1 } });
      if (identity.instanceId !== runtimeIdentity.instanceId) throw new InvalidStateError('ADMIN_AUTHORIZER_DATABASE_MISMATCH');
      await tx.$queryRaw`SELECT id FROM public.users WHERE id IN (${ctx.actor.userId}, ${input.targetId}) ORDER BY id FOR UPDATE`;
      const issuer = await tx.user.findUnique({ where: { id: ctx.actor.userId } });
      if (!issuer || issuer.accountStatus !== 'ACTIVE' || !subjectMatchesActorRole(issuer, ctx.actor)
        || !subjectHasRole(issuer, 'ADMIN') || issuer.password !== null || privateSession.expiresAt <= Date.now()) refuse();
      lease = await acquireV1InvitationIdentity({ issuerId: issuer.id, expectedIssuerRole: privateSession.role,
        expectedIssuerVersion: privateSession.sessionVersion, targetId: input.targetId, requireActiveTargetById: true });
      const prior = await tx.auditEvent.findFirst({ where: { action: 'account.admin_promoted', correlationId: input.commandId } });
      if (prior) {
        const intent = prior.metadata as Record<string, unknown> | null;
        if (prior.actorUserId !== issuer.id || prior.subjectId !== input.targetId || intent?.reason !== input.reason
          || intent.operation !== 'CORE_ADMIN_PROMOTION') throw new ConflictError('Promotion command cannot be reused.');
        await lease.verify(); if (privateSession.expiresAt <= Date.now()) refuse();
        return { outcome: 'ALREADY_PROMOTED' as const, targetId: input.targetId, receiptId: prior.id };
      }
      const target = await tx.user.findUnique({ where: { id: input.targetId } });
      if (!target || target.accountStatus !== 'ACTIVE' || target.password !== null
        || !(subjectHasRole(target, 'ASSISTANTE') || subjectHasRole(target, 'COACH'))) refuse();
      const receipt = await tx.auditEvent.create({ data: { actorUserId: issuer.id, action: 'account.admin_promoted',
        subjectType: 'User', subjectId: target.id, correlationId: input.commandId,
        metadata: { operation: 'CORE_ADMIN_PROMOTION', reason: input.reason, releaseSha,
          issuerV1Role: privateSession.role, issuerV1Version: privateSession.sessionVersion,
          expiresAt: new Date(Math.min(privateSession.expiresAt, Date.now() + 4_000)).toISOString() } } });
      await tx.$executeRaw`SET LOCAL ROLE nexus_core_admin_promotion`;
      const [promoted] = await tx.$queryRaw<Array<{ receipt: string }>>`SELECT public.core_promote_admin(${input.commandId}::uuid) AS receipt`;
      await tx.$executeRaw`RESET ROLE`;
      if (promoted?.receipt !== receipt.id) throw new InvalidStateError('ADMIN_PROMOTION_RECEIPT_MISMATCH');
      await lease.verify(); if (privateSession.expiresAt <= Date.now()) refuse();
      await assertBootstrapAttested(tx);
      return { outcome: 'PROMOTED' as const, targetId: target.id, receiptId: receipt.id };
    }, { timeout: 5_000 });
  } catch (error) {
    if (error instanceof V1InvitationScopeRefusal) refuse();
    throw error;
  } finally { await lease?.release().catch(() => undefined); }
}
