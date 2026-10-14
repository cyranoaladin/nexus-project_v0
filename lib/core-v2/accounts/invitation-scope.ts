/** One invitation scope authority. All inputs about identity and scope come from the database. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from '@/core-v2/generated/client';
import { ForbiddenError, ConflictError } from '../errors';
import { actorClaimsPromotedAdminV1Role, assertCapability, promotionProofMatchesV1Role, subjectHasRole, subjectMatchesActorRole, type Actor } from '../rbac';
import { appendAuditEvent } from '../audit';
import { type ServiceContext, type Tx } from '../services/context';
import { canonicalBootstrapJson } from './bootstrap-manifest';
import { lockV1AdminBootstrap } from './bootstrap-v1-admin';
import { credentialAuthorityIsV1 } from './v1-authority';
import { acquireV1InvitationIdentity, V1InvitationScopeRefusal, type V1IdentityLease, type V1InvitationIdentityContext } from '@/lib/auth/v1-invitation-authority';

export type InvitationOperation = 'INVITE' | 'RESEND';
export interface InvitationScope {
  readonly issuerId: string;
  readonly issuerRole: Actor['role'];
  readonly issuerVersion: string;
  readonly targetId: string;
  readonly targetRole: Actor['role'];
  readonly targetVersion: string;
  readonly recipientDigest: string;
  readonly operation: InvitationOperation;
  readonly databaseIdentity: string;
  readonly scopes: ReadonlyArray<{ householdId: string; academicYearId: string }>;
  readonly authorities: readonly string[];
}
export const INVITATION_SCOPE_REFUSAL = 'Invitation operation unavailable.';
export function invitationScopeFingerprint(scope: InvitationScope): string {
  return createHash('sha256').update(canonicalBootstrapJson(scope)).digest('hex');
}
function unavailable(): never { throw new ForbiddenError(INVITATION_SCOPE_REFUSAL); }

/**
 * A promoted ADMIN keeps its V1 role (promotion never touches V1). The role gap is accepted only
 * against the single attested receipt whose `fromRole` is exactly the V1 role presented.
 */
async function assertAttestedPromotion(tx: Tx, userId: string, v1Role: string): Promise<void> {
  const receipts = await tx.auditEvent.findMany({ where: { action: 'account.admin_promoted', subjectType: 'User', subjectId: userId },
    select: { metadata: true }, take: 2 });
  const metadata = receipts[0]?.metadata as Record<string, unknown> | null | undefined;
  if (receipts.length !== 1 || metadata?.targetId !== userId || metadata.operation !== 'CORE_ADMIN_PROMOTION'
    || !promotionProofMatchesV1Role(metadata.role, metadata.fromRole, v1Role)) unavailable();
}

/** Do not replace the original HTTP cookie version with the current DB version. */
export async function invitationRequestAuthority(tx: Tx, ctx: ServiceContext): Promise<Pick<V1InvitationIdentityContext,
  'expectedIssuerVersion' | 'expectedIssuerRole' | 'expectedSessionExpiresAt'>> {
  const claims = ctx.v1RequestAuthority;
  if (claims === undefined) return {}; // trusted CLI/service invocation
  const promotedAdmin = !!claims && actorClaimsPromotedAdminV1Role(claims, ctx.actor);
  if (!claims || claims.userId !== ctx.actor.userId || (!subjectMatchesActorRole(claims, ctx.actor) && !promotedAdmin)
    || !Number.isSafeInteger(claims.sessionVersion) || claims.sessionVersion < 0
    || !Number.isFinite(claims.expiresAt) || claims.expiresAt <= Date.now()) unavailable();
  if (promotedAdmin) await assertAttestedPromotion(tx, claims.userId, claims.role);
  return { expectedIssuerVersion: claims.sessionVersion, expectedIssuerRole: claims.role,
    expectedSessionExpiresAt: claims.expiresAt };
}

/** Acquired before any row lock. DB mutation triggers use this SAME global authority lock. */
export const lockInvitationAuthority = lockV1AdminBootstrap;

async function assertStoredInvitationActor(tx: Tx, actor: Actor) {
  await lockInvitationAuthority(tx);
  const issuer = await tx.user.findUnique({ where: { id: actor.userId }, select: { id: true, role: true, accountStatus: true } });
  if (!issuer || issuer.accountStatus !== 'ACTIVE' || !subjectMatchesActorRole(issuer, actor)
    || !(subjectHasRole(issuer, 'ADMIN') || subjectHasRole(issuer, 'ASSISTANTE'))) unavailable();
  return issuer;
}

/** Keep the V1 issuer lease through Core commit for every mutation of invitation authority. */
export async function withInvitationActor<T>(client: PrismaClient, ctx: ServiceContext, mutate: (tx: Tx) => Promise<T>): Promise<T> {
  let lease: V1IdentityLease | undefined;
  try {
    return await client.$transaction(async tx => {
      const issuer = await assertStoredInvitationActor(tx, ctx.actor);
      if (credentialAuthorityIsV1()) lease = await acquireV1InvitationIdentity({ issuerId: issuer.id,
        ...(await invitationRequestAuthority(tx, ctx)) });
      const result = await mutate(tx);
      await lease?.verify();
      return result;
    });
  } catch (error) {
    if (error instanceof V1InvitationScopeRefusal) unavailable();
    throw error;
  } finally { await lease?.release().catch(() => undefined); }
}

type AuthorityMutationLocator =
  | { kind: 'enrollment'; enrollmentId: string }
  | { kind: 'new-enrollment'; studentId: string; academicYearId: string }
  | { kind: 'household'; householdId: string; adoptExistingParent?: boolean }
  | { kind: 'parent'; parentUserId: string }
  | { kind: 'student'; studentId: string };
/** Resolve the affected scope BEFORE mutation; withdrawing it cannot erase this check. */
export async function assertInvitationAuthorityMutation(tx: Tx, actor: Actor, locator: AuthorityMutationLocator): Promise<void> {
  const issuer = await assertStoredInvitationActor(tx, actor);
  const global = subjectHasRole(issuer, 'ADMIN');
  if (locator.kind === 'household' && locator.adoptExistingParent && !global) unavailable();
  let householdId: string | undefined;
  let academicYearIds: string[] | undefined;
  if (locator.kind === 'enrollment') {
    const row = await tx.studentAcademicYearEnrollment.findUnique({ where: { id: locator.enrollmentId },
      select: { academicYearId: true, student: { select: { householdId: true } } } });
    if (!row) unavailable();
    householdId = row.student.householdId; academicYearIds = [row.academicYearId];
  } else if (locator.kind === 'new-enrollment' || locator.kind === 'student') {
    const row = await tx.student.findUnique({ where: { id: locator.studentId }, select: { householdId: true } });
    if (!row) unavailable();
    householdId = row.householdId;
    if (locator.kind === 'new-enrollment') {
      if (!(await tx.academicYear.findUnique({ where: { id: locator.academicYearId }, select: { id: true } }))) unavailable();
      academicYearIds = [locator.academicYearId];
    }
  } else if (locator.kind === 'parent') {
    const row = await tx.householdParent.findUnique({ where: { userId: locator.parentUserId }, select: { householdId: true } });
    if (!row) unavailable(); householdId = row.householdId;
  } else householdId = locator.householdId;
  if (!(await tx.household.findUnique({ where: { id: householdId }, select: { id: true } }))) unavailable();
  if (global) return;
  if (!academicYearIds) {
    const enrollments = await tx.studentAcademicYearEnrollment.findMany({ where: {
      student: { householdId }, status: { in: ['ACTIVE', 'PENDING'] }, academicYear: { status: { in: ['CURRENT', 'UPCOMING'] } } },
    select: { academicYearId: true } });
    academicYearIds = [...new Set(enrollments.map(row => row.academicYearId))];
    if (academicYearIds.length === 0) {
      // An explicit assignment permits preparation before the first enrollment.
      const grant = await tx.invitationScopeGrant.findFirst({ where: { staffUserId: issuer.id, householdId,
        revokedAt: null, academicYear: { status: { in: ['CURRENT', 'UPCOMING'] } } }, select: { id: true } });
      if (!grant) unavailable();
      return;
    }
  }
  for (const academicYearId of academicYearIds) {
    if (!(await tx.invitationScopeGrant.findFirst({ where: { staffUserId: issuer.id, householdId, academicYearId,
      revokedAt: null, academicYear: { status: { in: ['CURRENT', 'UPCOMING'] } } }, select: { id: true } }))) unavailable();
  }
}

export async function assertInvitationScope(
  tx: Tx, actor: Actor, operation: InvitationOperation, targetContext: { readonly userId: string },
): Promise<InvitationScope> {
  assertCapability(actor, 'ACCOUNT_INVITE');
  await lockInvitationAuthority(tx);
  const issuer = await tx.user.findUnique({ where: { id: actor.userId }, select: { id: true, role: true, accountStatus: true, invitationScopeVersion: true } });
  if (!issuer || issuer.accountStatus !== 'ACTIVE' || !subjectMatchesActorRole(issuer, actor)) unavailable();
  // Recheck the actual stored role before resolving a target.
  assertCapability({ userId: issuer.id, role: issuer.role }, 'ACCOUNT_INVITE');
  const global = subjectHasRole(issuer, 'ADMIN');
  const target = await tx.user.findUnique({ where: { id: targetContext.userId }, select: { id: true, role: true, email: true, accountStatus: true, invitationScopeVersion: true } });
  if (!target || !target.email || !['ACTIVE', 'PENDING_ACTIVATION'].includes(target.accountStatus)) unavailable();
  const identity = await tx.coreV2DatabaseIdentity.findUnique({ where: { id: 1 } });
  if (!identity) unavailable();
  const authorities: string[] = [];
  const scopes = new Map<string, { householdId: string; academicYearId: string }>();
  const targetIsParent = subjectHasRole(target, 'PARENT');
  const targetIsStudent = subjectHasRole(target, 'ELEVE');
  if (targetIsParent || targetIsStudent) {
    const [parent, student] = await Promise.all([
      tx.householdParent.findUnique({ where: { userId: target.id }, include: { user: { select: { role: true, accountStatus: true, invitationScopeVersion: true } } } }),
      tx.student.findUnique({ where: { userId: target.id }, include: { user: { select: { invitationScopeVersion: true } } } }),
    ]);
    if ((targetIsParent && (!parent || student)) || (targetIsStudent && (!student || parent))) unavailable();
    const householdId = targetIsParent ? parent!.householdId : student!.householdId;
    const parents = await tx.householdParent.findMany({ where: { householdId,
      verificationStatus: 'VERIFIED', revokedAt: null,
      user: { accountStatus: { in: ['ACTIVE', 'PENDING_ACTIVATION'] }, role: 'PARENT' } }, include: { user: { select: { role: true, accountStatus: true, invitationScopeVersion: true } } } });
    if (parents.length === 0 || (targetIsParent && !parents.some(row => row.userId === target.id))) unavailable();
    for (const row of parents) {
      if (!row.verifiedAt || !row.verifiedById || !row.verificationEvidenceDigest) unavailable();
      authorities.push('parent:' + row.id + ':' + row.invitationScopeVersion + ':' + row.user.invitationScopeVersion);
    }
    const students = targetIsStudent ? [student!] : await tx.student.findMany({ where: { householdId,
      user: { role: 'ELEVE', accountStatus: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } } },
      include: { user: { select: { invitationScopeVersion: true } } } });
    const enrollments = await tx.studentAcademicYearEnrollment.findMany({ where: {
      studentId: { in: students.map(row => row.id) }, status: 'ACTIVE',
      academicYear: { status: { in: ['CURRENT', 'UPCOMING'] } },
    }, include: { academicYear: true } });
    if (enrollments.length === 0) unavailable();
    for (const enrollment of enrollments) {
      const child = students.find(row => row.id === enrollment.studentId)!;
      if (!enrollment.approvedAt || !enrollment.approvedById) unavailable();
      authorities.push('student:' + child.id + ':' + child.invitationScopeVersion + ':' + child.user.invitationScopeVersion);
      authorities.push('enrollment:' + enrollment.id + ':' + enrollment.invitationScopeVersion);
      authorities.push('year:' + enrollment.academicYearId + ':' + enrollment.academicYear.invitationScopeVersion);
      scopes.set(householdId + ':' + enrollment.academicYearId, { householdId, academicYearId: enrollment.academicYearId });
    }
    if (!global) {
      for (const scope of scopes.values()) {
        const grant = await tx.invitationScopeGrant.findUnique({ where: { staffUserId_householdId_academicYearId:
          { staffUserId: issuer.id, ...scope } } });
        if (!grant || grant.revokedAt) unavailable();
        authorities.push('grant:' + grant.id + ':' + grant.invitationScopeVersion);
      }
    }
  } else if (!global || !(subjectHasRole(target, 'ASSISTANTE') || subjectHasRole(target, 'COACH'))) {
    unavailable();
  }
  return { issuerId: issuer.id, issuerRole: issuer.role, issuerVersion: issuer.invitationScopeVersion,
    targetId: target.id, targetRole: target.role, targetVersion: target.invitationScopeVersion,
    recipientDigest: createHash('sha256').update(target.email!.trim().toLowerCase()).digest('hex'), operation,
    databaseIdentity: identity.instanceId,
    scopes: [...scopes.values()].sort((a, b) => (a.householdId + a.academicYearId).localeCompare(b.householdId + b.academicYearId)),
    authorities: [...new Set(authorities)].sort() };
}

const grantSchema = z.object({ staffUserId: z.string().min(1).max(128), householdId: z.string().min(1).max(128),
  academicYearId: z.string().min(1).max(128), expectedRevision: z.number().int().nonnegative(), active: z.boolean() }).strict();
/** Assignment administration has a separate, ADMIN-only read model. */
export async function getInvitationScopeGrants(client: PrismaClient, ctx: ServiceContext, householdId: string) {
  assertCapability(ctx.actor, 'INVITATION_SCOPE_MANAGE');
  return withInvitationActor(client, ctx, async tx => {
    if (!subjectHasRole(ctx.actor, 'ADMIN')) unavailable();
    if (!(await tx.household.findUnique({ where: { id: householdId }, select: { id: true } }))) unavailable();
    const [assistants, years, grants] = await Promise.all([
      tx.user.findMany({ where: { role: 'ASSISTANTE' }, orderBy: { id: 'asc' },
        select: { id: true, firstName: true, lastName: true, accountStatus: true } }),
      tx.academicYear.findMany({ orderBy: { startYear: 'desc' }, select: { id: true, startYear: true, status: true } }),
      tx.invitationScopeGrant.findMany({ where: { householdId }, orderBy: { id: 'asc' },
        select: { staffUserId: true, academicYearId: true, revision: true, revokedAt: true } }),
    ]);
    return { householdId, assistants, years, grants };
  });
}
/** Explicit assignment by a stored ACTIVE ADMIN; no implicit whole-roster delegation. */
export async function setInvitationScopeGrant(client: PrismaClient, ctx: ServiceContext, raw: z.input<typeof grantSchema>) {
  assertCapability(ctx.actor, 'INVITATION_SCOPE_MANAGE');
  const input = grantSchema.parse(raw);
  return withInvitationActor(client, ctx, async tx => {
    await lockInvitationAuthority(tx);
    const issuer = await tx.user.findUnique({ where: { id: ctx.actor.userId }, select: { id: true, role: true, accountStatus: true } });
    if (!issuer || !subjectMatchesActorRole(issuer, ctx.actor) || !subjectHasRole(issuer, 'ADMIN') || issuer.accountStatus !== 'ACTIVE') unavailable();
    const [staff, household, year] = await Promise.all([
      tx.user.findUnique({ where: { id: input.staffUserId }, select: { id: true, role: true, accountStatus: true } }), tx.household.findUnique({ where: { id: input.householdId } }),
      tx.academicYear.findUnique({ where: { id: input.academicYearId } }),
    ]);
    if (!staff || !subjectHasRole(staff, 'ASSISTANTE') || !household || !year
      || (input.active && (year.status === 'CLOSED' || staff.accountStatus !== 'ACTIVE'))) unavailable();
    const where = { staffUserId_householdId_academicYearId: { staffUserId: input.staffUserId,
      householdId: input.householdId, academicYearId: input.academicYearId } };
    const prior = await tx.invitationScopeGrant.findUnique({ where });
    if ((prior?.revision ?? 0) !== input.expectedRevision) throw new ConflictError('Invitation scope changed.');
    const data = { grantedById: issuer.id, revokedAt: input.active ? null : ctx.now(), revision: input.expectedRevision + 1 };
    const grant = prior ? await tx.invitationScopeGrant.update({ where: { id: prior.id }, data })
      : await tx.invitationScopeGrant.create({ data: { ...where.staffUserId_householdId_academicYearId, ...data } });
    await appendAuditEvent(tx, { actorUserId: issuer.id, action: input.active ? 'account.invitation_scope_granted' : 'account.invitation_scope_revoked',
      subjectType: 'InvitationScopeGrant', subjectId: grant.id, correlationId: ctx.correlationId,
      metadata: { revision: grant.revision } });
    return grant;
  });
}

const scopeSchema = z.object({ issuerId: z.string().min(1), issuerRole: z.enum(['ADMIN','ASSISTANTE','COACH','PARENT','ELEVE']),
  issuerVersion: z.string().uuid(), targetId: z.string().min(1), targetRole: z.enum(['ADMIN','ASSISTANTE','COACH','PARENT','ELEVE']),
  targetVersion: z.string().uuid(), recipientDigest: z.string().regex(/^[a-f0-9]{64}$/),
  operation: z.enum(['INVITE','RESEND']), databaseIdentity: z.string().uuid(),
  scopes: z.array(z.object({ householdId: z.string().min(1), academicYearId: z.string().min(1) }).strict()),
  authorities: z.array(z.string().min(1)),
}).strict();
const bindingSchema = z.object({ schemaVersion: z.literal('core-invitation-binding/v1'),
  generation: z.number().int().positive(), v1IssuerVersion: z.number().int().nonnegative().nullable(), scope: scopeSchema, fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export interface InvitationBinding { readonly schemaVersion: 'core-invitation-binding/v1'; readonly generation: number; readonly v1IssuerVersion: number | null;
  readonly scope: InvitationScope; readonly fingerprint: string; }
export function bindInvitationScope(scope: InvitationScope, generation: number, v1IssuerVersion: number | null = null): z.infer<typeof bindingSchema> {
  const body = { schemaVersion: 'core-invitation-binding/v1' as const, generation, v1IssuerVersion, scope };
  return bindingSchema.parse({ ...body, fingerprint: createHash('sha256').update(canonicalBootstrapJson(body)).digest('hex') });
}
export async function assertCurrentInvitationBinding(tx: Tx, saga: { userId: string; generation: number;
  requestedById: string | null; invitationBinding: unknown }): Promise<InvitationBinding> {
  const parsed = bindingSchema.safeParse(saga.invitationBinding);
  if (!parsed.success) unavailable();
  const binding = parsed.data;
  if (bindInvitationScope(binding.scope, binding.generation, binding.v1IssuerVersion).fingerprint !== binding.fingerprint) unavailable();
  if (binding.scope.targetId !== saga.userId || binding.generation !== saga.generation
    || binding.scope.issuerId !== saga.requestedById) unavailable();
  const current = await assertInvitationScope(tx, { userId: binding.scope.issuerId, role: binding.scope.issuerRole },
    binding.scope.operation, { userId: saga.userId });
  if (bindInvitationScope(current, saga.generation, binding.v1IssuerVersion).fingerprint !== binding.fingerprint) unavailable();
  return binding;
}
