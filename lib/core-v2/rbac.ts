/**
 * THE Core v2 RBAC authority (go-live mission §Y). Every back-office
 * mutation in lib/core-v2/services/** and app/api/v2/** decides access by
 * calling assertCapability() — never by comparing `role` inline. The
 * architecture guard CORE_V2_NO_INLINE_RBAC (core-v2-legacy-guards.test.ts)
 * fails the build on any `role ===`, role array, or role string literal
 * outside this file.
 *
 * ADMIN / ASSISTANTE difference, made explicit (derived from the live Core v1
 * policy map in lib/rbac.ts: ASSISTANTE has READ-only on USER, no admin.*
 * policy, no CONFIG/REPORT management):
 *   - account lifecycle beyond inviting (suspend / reactivate) is ADMIN-only
 *   - reading the audit trail is ADMIN-only
 *   - everything else in the daily staff workflow is shared.
 * COACH / PARENT / ELEVE hold no back-office capability at all; what they may
 * SEE of their own data is a scope rule on the read side, not a capability.
 */
import type { UserRole } from '@/core-v2/generated/client';
import { ForbiddenError, ValidationError } from './errors';

export const CAPABILITIES = [
  'HOUSEHOLD_READ',
  'HOUSEHOLD_CREATE',
  'HOUSEHOLD_EDIT',
  'PARENT_CREATE',
  'PARENT_ATTACH',
  'STUDENT_CREATE',
  'STUDENT_EDIT',
  'ENROLLMENT_CREATE',
  'ENROLLMENT_APPROVE',
  'ENROLLMENT_WITHDRAW',
  'COURSE_MANAGE',
  'COACH_CAPABILITY_MANAGE',
  'COACH_ASSIGN',
  'PLANNING_MANAGE',
  'ACCOUNT_INVITE',
  'ACCOUNT_SUSPEND',
  'ACCOUNT_REACTIVATE',
  'AUDIT_READ',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export interface Actor {
  readonly userId: string;
  readonly role: UserRole;
}

const ADMIN_ONLY: readonly Capability[] = ['ACCOUNT_SUSPEND', 'ACCOUNT_REACTIVATE', 'AUDIT_READ'];

const STAFF_SHARED: readonly Capability[] = CAPABILITIES.filter((c) => !ADMIN_ONLY.includes(c));

const CAPABILITY_MATRIX: Readonly<Record<UserRole, ReadonlySet<Capability>>> = {
  ADMIN: new Set<Capability>(CAPABILITIES),
  ASSISTANTE: new Set<Capability>(STAFF_SHARED),
  COACH: new Set<Capability>(),
  PARENT: new Set<Capability>(),
  ELEVE: new Set<Capability>(),
};

export function roleHasCapability(role: UserRole, capability: Capability): boolean {
  return CAPABILITY_MATRIX[role]?.has(capability) ?? false;
}

export function capabilitiesForRole(role: UserRole): readonly Capability[] {
  return CAPABILITIES.filter((c) => roleHasCapability(role, c));
}

/** What the UI may offer this actor — the only sanctioned way to read an actor's grants outside this file. */
export function capabilitiesForActor(actor: Actor): readonly Capability[] {
  return capabilitiesForRole(actor.role);
}

export function assertCapability(actor: Actor, capability: Capability): void {
  if (!roleHasCapability(actor.role, capability)) {
    throw new ForbiddenError(`Capability ${capability} is not granted to this actor.`, { capability });
  }
}

/**
 * Self-service scope (read side, see header): a "my own data" endpoint is
 * reachable only by an actor of the role that owns such data (a PARENT reads
 * their household). It grants nothing beyond the actor's own rows — the query
 * must still scope by actor.userId. Lives here so routes never compare roles.
 */
export function assertSelfServiceRole(actor: Actor, expected: UserRole): void {
  if (actor.role !== expected) {
    throw new ForbiddenError(`This resource is only available to ${expected} accounts.`, { expectedRole: expected });
  }
}

/**
 * Data-shape check, not an authorization decision: "the user being attached
 * as a parent must actually be a PARENT account". Lives here so it is the
 * single place in Core v2 that compares a role value (see CORE_V2_NO_INLINE_RBAC).
 */
export function assertSubjectRole(
  subject: { readonly id: string; readonly role: UserRole },
  expected: UserRole,
): void {
  if (subject.role !== expected) {
    throw new ValidationError(`User ${subject.id} is not a ${expected} account.`, {
      expectedRole: expected,
      actualRole: subject.role,
    });
  }
}
