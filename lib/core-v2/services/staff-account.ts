/**
 * Staff accounts — the half of provisioning Core v2 was missing.
 *
 * `createHousehold`/`createParent` hardcode PARENT and `createStudent`
 * hardcodes ELEVE, so until now no sanctioned path could bring an ASSISTANTE
 * or a COACH into existence: Core v2 could hold families but not the people
 * who operate them. This service closes exactly that gap and nothing more.
 *
 * Two deliberate limits:
 *   - ADMIN is NOT creatable here. The first administrator comes from the
 *     one-time bootstrap (scripts/core-v2/bootstrap-admin.ts); afterwards an
 *     administrator is an owner decision, not a back-office gesture.
 *   - No password is ever accepted or written. The account is born
 *     PENDING_ACTIVATION and becomes usable only through the ordinary
 *     invitation → activation lifecycle, which is where bcrypt lives.
 *
 * A COACH gets its CoachProfile in the SAME transaction: a coach user without
 * a profile cannot be granted a capability nor assigned, so creating one
 * without the other would only produce an account that looks fine and works
 * nowhere.
 */
import { z } from 'zod';
import type { CoachProfile, PrismaClient, User } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { normalizeEmail, normalizePhone } from '../contact';
import { ConflictError, isUniqueViolation } from '../errors';
import { assertCapability } from '../rbac';
import type { ServiceContext } from './context';
import { inTransaction } from './context';
import { parseInput, personNameSchema } from './validation';

/** Closed set: the roles a back office may create. ADMIN is deliberately absent. */
export const CREATABLE_STAFF_ROLES = ['ASSISTANTE', 'COACH'] as const;

export type CreatableStaffRole = (typeof CREATABLE_STAFF_ROLES)[number];

/**
 * What each creatable role needs alongside its user row, keyed by role —
 * DATA, not a branch comparing a role. Deciding anything by looking at a role
 * inline is the authority rbac.ts alone holds (CORE_V2_NO_INLINE_RBAC), and
 * the `Record` makes the table total: adding a creatable role without saying
 * what it needs stops compiling.
 */
const STAFF_ROLE_PROVISIONING: Readonly<Record<CreatableStaffRole, { readonly needsCoachProfile: boolean }>> = {
  ASSISTANTE: { needsCoachProfile: false },
  COACH: { needsCoachProfile: true },
};

const newStaffAccountSchema = z.object({
  role: z.enum(CREATABLE_STAFF_ROLES),
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: z.string().min(1),
  phone: z.string().min(1).optional(),
});

export type NewStaffAccountInput = z.input<typeof newStaffAccountSchema>;

export interface CreatedStaffAccount {
  readonly user: User;
  /** Present only for a COACH — created in the same transaction as the user. */
  readonly coachProfile: CoachProfile | null;
}

/**
 * Creates one ASSISTANTE or COACH account, PENDING_ACTIVATION and without a
 * password, plus the CoachProfile a coach needs. Invite it afterwards with
 * `inviteAccount` — the account cannot sign in until it is activated.
 */
export async function createStaffAccount(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: NewStaffAccountInput,
): Promise<CreatedStaffAccount> {
  assertCapability(ctx.actor, 'STAFF_ACCOUNT_CREATE');
  const input = parseInput(newStaffAccountSchema, rawInput);
  const email = normalizeEmail(input.email);
  const phone = input.phone ? normalizePhone(input.phone) : undefined;

  return inTransaction(client, async (tx) => {
    let user: User;
    try {
      user = await tx.user.create({
        data: { role: input.role, firstName: input.firstName, lastName: input.lastName, email, phone },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('An account with this email already exists.', { field: 'email' });
      }
      throw error;
    }

    let coachProfile: CoachProfile | null = null;
    if (STAFF_ROLE_PROVISIONING[input.role].needsCoachProfile) {
      try {
        coachProfile = await tx.coachProfile.create({ data: { userId: user.id } });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError('This user already has a coach profile.', { userId: user.id });
        }
        throw error;
      }
      await appendAuditEvent(tx, {
        actorUserId: ctx.actor.userId,
        action: 'coach.profile_created',
        subjectType: 'CoachProfile',
        subjectId: coachProfile.id,
        correlationId: ctx.correlationId,
        metadata: { userId: user.id },
      });
    }

    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'staff.account_created',
      subjectType: 'User',
      subjectId: user.id,
      correlationId: ctx.correlationId,
      metadata: { role: input.role, coachProfileId: coachProfile?.id ?? null },
    });

    return { user, coachProfile };
  });
}
