/**
 * Real notification, P7c: fires exactly once per real ARIA_PERIODIC bilan
 * publication — the caller (`PUT /api/bilans/[id]`) only invokes this
 * immediately after a real `isPublished: false -> true` write for that
 * type, never on a republish (already-published bilans never re-enter the
 * false->true branch, so this call site never re-fires — the dedupeKey
 * below is still a genuine DB-level backstop for a concurrent double-fire).
 *
 * Split in two, deliberately:
 *  - `resolvePeriodicBilanNotificationIntent` is a pure read: it decides
 *    WHETHER a parent should be notified (parent exists, has a usable
 *    email, AND their `parentReporting` ARIA capability is granted for
 *    this child — the same tier gate `listAriaPeriodicBilansForParent`
 *    already applies to the list, so a parent whose tier doesn't include
 *    parent reporting can neither see the bilan in their list NOR receive
 *    an email pointing at its detail page) and builds the email content.
 *    It never writes.
 *  - `enqueuePeriodicBilanNotification` performs the one write (the real,
 *    already-connected `lib/email/outbox.ts` intent — never the dormant
 *    `NotificationOutbox`) and MUST be called inside the same Prisma
 *    transaction as the bilan's publish update, so the publish and the
 *    durable notification intent commit or roll back together. There is
 *    no window in which the bilan is published but no notification intent
 *    was durably recorded — a transient failure of `enqueueEmailIntent`
 *    now rolls back the publish itself instead of silently swallowing the
 *    lost notification, which is the correct trade-off here since the
 *    caller can simply retry the PUT.
 *
 * Never includes `parentsMarkdown`/`nexusMarkdown` in the email — real
 * pedagogical content stays behind the authenticated parent detail page,
 * never in the email body itself.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { buildHumanRenderIdentity } from '@/lib/bilans/render/human-identity';
import { buildCanonicalAriaEntitlementContext, resolveAriaCapabilities } from '@/lib/aria/kernel/entitlements';
import { buildPeriodicBilanPublishedEmail } from './periodic-bilan-published-email';

export const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export interface PeriodicBilanNotificationIntent {
  readonly parentUserId: string;
  readonly parentEmail: string;
  readonly dedupeKey: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/**
 * Read-only: decides whether a parent notification should be sent, and
 * builds its content. Returns `null` whenever no email should go out —
 * missing parent/email/name (defensive — should not happen for a real
 * activated family) OR the child's ARIA tier does not include
 * `parentReporting`. Never throws for an ineligible-but-real family: the
 * absence of a notification must look identical to "nothing to send",
 * exactly like `listAriaPeriodicBilansForParent`'s empty list.
 */
export async function resolvePeriodicBilanNotificationIntent(input: {
  readonly bilanId: string;
  readonly studentId: string;
  readonly subject: string;
}): Promise<PeriodicBilanNotificationIntent | null> {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: {
      user: {
        select: {
          firstName: true,
          // Entitlements are attached to the CHILD's own User row
          // (Entitlement.userId = the beneficiary student, never the
          // paying parent — same relation load-child-for-parent.ts
          // reads for the identical reason), not the parent's.
          entitlements: {
            select: {
              id: true,
              productCode: true,
              status: true,
              startsAt: true,
              endsAt: true,
              ariaTier: true,
              ariaScopes: { select: { kind: true, courseKey: true } },
            },
          },
        },
      },
      parent: {
        select: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  const parentUser = student?.parent.user;
  const parentEmail = parentUser?.email?.trim();
  const studentFirstNameRaw = student?.user.firstName?.trim();
  const parentHasAnyName = Boolean(parentUser?.firstName?.trim() || parentUser?.lastName?.trim());
  if (!parentUser || !parentEmail || !studentFirstNameRaw || !parentHasAnyName) return null;

  // Same tier gate as the parent's bilan list and detail read — a parent
  // on ARIA_AUTONOMIE (no parentReporting) never learns a periodic bilan
  // was published, exactly as they never see it appear in their list.
  const entitlements = buildCanonicalAriaEntitlementContext(student!.user.entitlements, new Date());
  if (!resolveAriaCapabilities(entitlements.tier).parentReporting) return null;

  const origin = (process.env.NEXTAUTH_URL ?? 'https://nexusreussite.academy').replace(/\/$/, '');
  const parentDisplayName = buildHumanRenderIdentity({
    firstName: parentUser.firstName,
    lastName: parentUser.lastName,
  }).displayName;
  const studentFirstName = buildHumanRenderIdentity({ firstName: studentFirstNameRaw, lastName: null }).displayName;

  const message = buildPeriodicBilanPublishedEmail({
    parentDisplayName,
    studentFirstName,
    subject: input.subject,
    dashboardUrl: `${origin}/dashboard/parent/bilans/${input.bilanId}`,
  });

  return {
    parentUserId: parentUser.id,
    parentEmail,
    dedupeKey: `aria-periodic-bilan-published:${input.bilanId}`,
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
}

/**
 * The one write. MUST run inside the same transaction as the bilan
 * publish update (see the module docstring) — callers outside a
 * transaction are a bug, not a convenience. A concurrent double-fire
 * (two transactions racing to publish + notify the same bilan) surfaces
 * here as a unique-constraint violation on `dedupeKey`; the caller's
 * transaction wrapper is expected to treat that as a benign no-op (the
 * bilan is already published and already notified by the transaction
 * that won the race) rather than as a real failure.
 */
export async function enqueuePeriodicBilanNotification(
  transaction: Prisma.TransactionClient,
  intent: PeriodicBilanNotificationIntent,
): Promise<void> {
  await enqueueEmailIntent(transaction, {
    aggregateId: intent.parentUserId,
    messageType: 'TRANSACTIONAL_NOTIFICATION',
    dedupeKey: intent.dedupeKey,
    to: intent.parentEmail,
    subject: intent.subject,
    html: intent.html,
    text: intent.text,
  });
}

export function isDuplicateNotificationError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
  );
}
