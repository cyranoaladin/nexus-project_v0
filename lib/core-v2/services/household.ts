/**
 * Household = family authority. One parent user belongs to at most one
 * household (HouseholdParent.userId unique); at most one primary contact per
 * household (partial unique index household_parents_primary_contact_key).
 */
import { z } from 'zod';
import type { Household, HouseholdParent, PrismaClient, User } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { normalizeEmail, normalizePhone } from '../contact';
import { ConflictError, NotFoundError, isUniqueViolation } from '../errors';
import { assertCapability, assertSubjectRole } from '../rbac';
import type { ServiceContext, Tx } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput, personNameSchema } from './validation';

const newParentSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: z.string().min(1),
  phone: z.string().min(1).optional(),
});

export type NewParentInput = z.input<typeof newParentSchema>;

async function insertParentUser(tx: Tx, input: z.infer<typeof newParentSchema>): Promise<User> {
  const email = normalizeEmail(input.email);
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  try {
    return await tx.user.create({
      data: { role: 'PARENT', firstName: input.firstName, lastName: input.lastName, email, phone },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('An account with this email already exists.', { field: 'email' });
    }
    throw error;
  }
}

async function insertMembership(
  tx: Tx,
  householdId: string,
  userId: string,
  isPrimaryContact: boolean,
): Promise<HouseholdParent> {
  try {
    return await tx.householdParent.create({ data: { householdId, userId, isPrimaryContact } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('This parent already belongs to a household, or the household already has a primary contact.', {
        householdId,
        userId,
      });
    }
    throw error;
  }
}

/** Creates a household with its first parent (new account) — never a parentless household. */
export async function createHousehold(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly parent: NewParentInput },
): Promise<{ household: Household; parent: User; membership: HouseholdParent }> {
  assertCapability(ctx.actor, 'HOUSEHOLD_CREATE');
  const parentInput = parseInput(newParentSchema, rawInput.parent);

  return inTransaction(client, async (tx) => {
    const parent = await insertParentUser(tx, parentInput);
    const household = await tx.household.create({ data: {} });
    const membership = await insertMembership(tx, household.id, parent.id, true);
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'parent.created',
      subjectType: 'User',
      subjectId: parent.id,
      correlationId: ctx.correlationId,
    });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'household.created',
      subjectType: 'Household',
      subjectId: household.id,
      correlationId: ctx.correlationId,
      metadata: { primaryContactUserId: parent.id },
    });
    return { household, parent, membership };
  });
}

/** Creates a new parent account and attaches it to an existing household. */
export async function createParent(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly householdId: string; readonly parent: NewParentInput; readonly isPrimaryContact?: boolean },
): Promise<{ parent: User; membership: HouseholdParent }> {
  assertCapability(ctx.actor, 'PARENT_CREATE');
  const householdId = parseInput(idSchema, rawInput.householdId);
  const parentInput = parseInput(newParentSchema, rawInput.parent);

  return inTransaction(client, async (tx) => {
    const household = await tx.household.findUnique({ where: { id: householdId } });
    if (!household) throw new NotFoundError('Household not found.', { householdId });
    const parent = await insertParentUser(tx, parentInput);
    const membership = await insertMembership(tx, householdId, parent.id, rawInput.isPrimaryContact ?? false);
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'parent.created',
      subjectType: 'User',
      subjectId: parent.id,
      correlationId: ctx.correlationId,
    });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'household.parent_attached',
      subjectType: 'Household',
      subjectId: householdId,
      correlationId: ctx.correlationId,
      metadata: { parentUserId: parent.id, isPrimaryContact: membership.isPrimaryContact },
    });
    return { parent, membership };
  });
}

/** Attaches an EXISTING parent account to a household (the account must not already belong to one). */
export async function attachExistingParent(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly householdId: string; readonly parentUserId: string; readonly isPrimaryContact?: boolean },
): Promise<HouseholdParent> {
  assertCapability(ctx.actor, 'PARENT_ATTACH');
  const householdId = parseInput(idSchema, rawInput.householdId);
  const parentUserId = parseInput(idSchema, rawInput.parentUserId);

  return inTransaction(client, async (tx) => {
    const household = await tx.household.findUnique({ where: { id: householdId } });
    if (!household) throw new NotFoundError('Household not found.', { householdId });
    const user = await tx.user.findUnique({ where: { id: parentUserId } });
    if (!user) throw new NotFoundError('Parent account not found.', { parentUserId });
    assertSubjectRole(user, 'PARENT');
    const membership = await insertMembership(tx, householdId, parentUserId, rawInput.isPrimaryContact ?? false);
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'household.parent_attached',
      subjectType: 'Household',
      subjectId: householdId,
      correlationId: ctx.correlationId,
      metadata: { parentUserId, isPrimaryContact: membership.isPrimaryContact },
    });
    return membership;
  });
}

/** Makes one member the primary contact; the previous primary (if any) is demoted in the same transaction. */
export async function setPrimaryContact(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly householdId: string; readonly parentUserId: string },
): Promise<HouseholdParent> {
  assertCapability(ctx.actor, 'HOUSEHOLD_EDIT');
  const householdId = parseInput(idSchema, rawInput.householdId);
  const parentUserId = parseInput(idSchema, rawInput.parentUserId);

  return inTransaction(client, async (tx) => {
    const membership = await tx.householdParent.findUnique({ where: { userId: parentUserId } });
    if (!membership || membership.householdId !== householdId) {
      throw new NotFoundError('This parent is not a member of this household.', { householdId, parentUserId });
    }
    await tx.householdParent.updateMany({
      where: { householdId, isPrimaryContact: true, NOT: { userId: parentUserId } },
      data: { isPrimaryContact: false },
    });
    let updated: HouseholdParent;
    try {
      updated = await tx.householdParent.update({ where: { userId: parentUserId }, data: { isPrimaryContact: true } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Another parent became primary contact concurrently.', { householdId });
      }
      throw error;
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'household.primary_contact_changed',
      subjectType: 'Household',
      subjectId: householdId,
      correlationId: ctx.correlationId,
      metadata: { parentUserId },
    });
    return updated;
  });
}

const parentCorrectionSchema = z
  .object({
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    email: z.string().min(1).optional(),
    phone: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'No correction provided.' });

export type ParentCorrectionInput = z.input<typeof parentCorrectionSchema>;

/** Staff correction of a parent's identity/contact. Audit records WHICH fields changed, never the values. */
export async function correctParentContact(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly parentUserId: string; readonly changes: ParentCorrectionInput },
): Promise<User> {
  assertCapability(ctx.actor, 'HOUSEHOLD_EDIT');
  const parentUserId = parseInput(idSchema, rawInput.parentUserId);
  const changes = parseInput(parentCorrectionSchema, rawInput.changes);

  return inTransaction(client, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: parentUserId } });
    if (!user) throw new NotFoundError('Parent account not found.', { parentUserId });
    assertSubjectRole(user, 'PARENT');
    // A login-identifier change (email/phone) revokes live sessions, like every
    // other identity-affecting User update in this codebase.
    const identityChanged = changes.email !== undefined || changes.phone !== undefined;
    const data = {
      firstName: changes.firstName,
      lastName: changes.lastName,
      email: changes.email !== undefined ? normalizeEmail(changes.email) : undefined,
      phone: changes.phone === null ? null : changes.phone !== undefined ? normalizePhone(changes.phone) : undefined,
      ...(identityChanged ? { sessionVersion: { increment: 1 } } : {}),
    };
    let updated: User;
    try {
      updated = await tx.user.update({ where: { id: parentUserId }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('An account with this email already exists.', { field: 'email' });
      }
      throw error;
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'parent.contact_corrected',
      subjectType: 'User',
      subjectId: parentUserId,
      correlationId: ctx.correlationId,
      metadata: { fields: Object.keys(changes) },
    });
    return updated;
  });
}
