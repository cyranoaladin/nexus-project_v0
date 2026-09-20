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
 *   - creating a staff account (ASSISTANTE / COACH) is ADMIN-only
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
  'STAFF_ACCOUNT_CREATE',
  'AUDIT_READ',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export interface Actor {
  readonly userId: string;
  readonly role: UserRole;
}

/**
 * Exported so tests can assert "ASSISTANTE = everything except this set"
 * against the set itself rather than a hand-counted number that silently
 * drifts the next time a capability is added.
 */
export const ADMIN_ONLY_CAPABILITIES: readonly Capability[] = [
  'ACCOUNT_SUSPEND',
  'ACCOUNT_REACTIVATE',
  // Creating a colleague is a different act from inviting one: it decides who
  // exists at all in the back office. An ASSISTANTE may invite an account
  // someone else created; she may not bring a new staff member into being.
  'STAFF_ACCOUNT_CREATE',
  'AUDIT_READ',
];

/**
 * Positive, exhaustive classification of every non-ADMIN-only capability —
 * replaces a previous derivation ("every capability except the ADMIN-only
 * set") that silently granted ASSISTANTE any capability added to
 * `CAPABILITIES` without a matching decision. A capability now reaches
 * ASSISTANTE only by being named here; one merely added to `CAPABILITIES`
 * and forgotten in both lists is denied by default (see
 * `roleHasCapability`) and fails `assertCapabilityClassificationIsExhaustive`
 * (enforced at module load and by a dedicated test) instead of leaking.
 */
export const ASSISTANTE_CAPABILITIES: readonly Capability[] = [
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
];

/**
 * Fails loudly — at import time, so no server boots and no test suite
 * passes on a drift — if a capability is classified in both lists, or in
 * neither. This is the completeness guard the classification exists for;
 * a dedicated test also asserts it directly so CI names the failure
 * without needing the module to be imported first.
 */
export function assertCapabilityClassificationIsExhaustive(): void {
  const overlap = ADMIN_ONLY_CAPABILITIES.filter((c) => ASSISTANTE_CAPABILITIES.includes(c));
  if (overlap.length > 0) {
    throw new Error(
      `CORE_V2_RBAC_CAPABILITY_DOUBLE_CLASSIFIED: ${overlap.join(', ')} listed in both ` +
      'ADMIN_ONLY_CAPABILITIES and ASSISTANTE_CAPABILITIES.',
    );
  }
  const classified = new Set<Capability>([...ADMIN_ONLY_CAPABILITIES, ...ASSISTANTE_CAPABILITIES]);
  const unclassified = CAPABILITIES.filter((c) => !classified.has(c));
  if (unclassified.length > 0) {
    throw new Error(
      `CORE_V2_RBAC_UNCLASSIFIED_CAPABILITY: ${unclassified.join(', ')} must be added to ` +
      'ADMIN_ONLY_CAPABILITIES or ASSISTANTE_CAPABILITIES — a new capability is denied to ' +
      'ASSISTANTE by default, not granted by omission.',
    );
  }
}
assertCapabilityClassificationIsExhaustive();

const CAPABILITY_MATRIX: Readonly<Record<UserRole, ReadonlySet<Capability>>> = {
  ADMIN: new Set<Capability>(CAPABILITIES),
  ASSISTANTE: new Set<Capability>(ASSISTANTE_CAPABILITIES),
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
