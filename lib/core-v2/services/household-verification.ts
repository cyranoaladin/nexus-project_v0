import { z } from 'zod';
import type { HouseholdParent, PrismaClient } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { ConflictError, NotFoundError } from '../errors';
import { assertCapability, assertSubjectRole } from '../rbac';
import { inTransaction, type ServiceContext } from './context';
import { idSchema, parseInput } from './validation';

const transitionSchema = z.object({
  householdId: idSchema,
  parentUserId: idSchema,
  expectedRevision: z.number().int().nonnegative(),
}).strict();
const verifySchema = transitionSchema.extend({ evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/) });
export type VerifyHouseholdParentInput = z.input<typeof verifySchema>;
export type RevokeHouseholdParentInput = z.input<typeof transitionSchema>;

export async function verifyHouseholdParent(
  client: PrismaClient, ctx: ServiceContext, rawInput: VerifyHouseholdParentInput,
): Promise<HouseholdParent> {
  assertCapability(ctx.actor, 'HOUSEHOLD_EDIT');
  const input = parseInput(verifySchema, rawInput);
  return inTransaction(client, async tx => {
    const membership = await tx.householdParent.findUnique({ where: { userId: input.parentUserId }, include: { user: true } });
    if (!membership || membership.householdId !== input.householdId) throw new NotFoundError('Household membership not found.');
    assertSubjectRole(membership.user, 'PARENT');
    const changed = await tx.householdParent.updateMany({
      where: { id: membership.id, householdId: input.householdId, revision: input.expectedRevision },
      data: { verificationStatus: 'VERIFIED', verifiedAt: ctx.now(), verifiedById: ctx.actor.userId,
        verificationEvidenceDigest: input.evidenceDigest, revokedAt: null, revision: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictError('Household membership changed; reload before verifying.');
    await appendAuditEvent(tx, { actorUserId: ctx.actor.userId, action: 'household.parent_verified',
      subjectType: 'Household', subjectId: input.householdId, correlationId: ctx.correlationId,
      metadata: { parentUserId: input.parentUserId, previousStatus: membership.verificationStatus, revision: input.expectedRevision + 1 } });
    return tx.householdParent.findUniqueOrThrow({ where: { id: membership.id } });
  });
}

export async function revokeHouseholdParent(
  client: PrismaClient, ctx: ServiceContext, rawInput: RevokeHouseholdParentInput,
): Promise<HouseholdParent> {
  assertCapability(ctx.actor, 'HOUSEHOLD_EDIT');
  const input = parseInput(transitionSchema, rawInput);
  return inTransaction(client, async tx => {
    const membership = await tx.householdParent.findUnique({ where: { userId: input.parentUserId } });
    if (!membership || membership.householdId !== input.householdId) throw new NotFoundError('Household membership not found.');
    const changed = await tx.householdParent.updateMany({
      where: { id: membership.id, householdId: input.householdId, revision: input.expectedRevision },
      data: { verificationStatus: 'REVOKED', revokedAt: ctx.now(), isPrimaryContact: false, revision: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictError('Household membership changed; reload before revoking.');
    await appendAuditEvent(tx, { actorUserId: ctx.actor.userId, action: 'household.parent_revoked',
      subjectType: 'Household', subjectId: input.householdId, correlationId: ctx.correlationId,
      metadata: { parentUserId: input.parentUserId, previousStatus: membership.verificationStatus, revision: input.expectedRevision + 1 } });
    return tx.householdParent.findUniqueOrThrow({ where: { id: membership.id } });
  });
}
