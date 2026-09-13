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

/** The exact JobOutbox column this module's dedupeKey collision surfaces on. */
const DEDUPE_KEY_CONSTRAINT_COLUMN = 'idempotencyKey';

/**
 * `NEXTAUTH_URL` is REQUIRED in production (lib/env-validation.ts) — this
 * function trusts that guarantee rather than falling back to a hardcoded
 * domain literal. A hardcoded fallback would silently point every parent
 * notification email at the wrong instance (or a decommissioned one)
 * whenever the real origin variable is ever misconfigured; failing loudly
 * here surfaces that misconfiguration immediately instead of shipping a
 * broken link.
 */
function requiredPublicOrigin(): string {
  const raw = process.env.NEXTAUTH_URL?.trim();
  if (!raw) {
    throw new Error('NEXTAUTH_URL_REQUIRED_FOR_PARENT_NOTIFICATION_EMAIL');
  }
  return raw.replace(/\/$/, '');
}

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
 *
 * `db` defaults to the global `prisma` client, but the real call site
 * (`PUT /api/bilans/[id]`) always passes its own open transaction: the
 * entitlement/parent-contact read must happen at the same transactional
 * consistency point as the row-lock that decides the publish transition,
 * not against a snapshot taken before the transaction even started.
 */
export async function resolvePeriodicBilanNotificationIntent(
  input: {
    readonly bilanId: string;
    readonly studentId: string;
    readonly subject: string;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PeriodicBilanNotificationIntent | null> {
  // Closes a race a plain (unlocked) read would leave open: under READ
  // COMMITTED, a bare SELECT never blocks on a concurrent writer — it
  // just returns whichever version was already committed at the instant
  // it runs. If an entitlement REVOKE/SUSPEND (suspendEntitlements /
  // entitlement.update in lib/entitlement/engine.ts) is in flight but not
  // yet committed exactly when this function's read would fire, a plain
  // SELECT would silently return the still-current-but-about-to-be-stale
  // ACTIVE row instead of waiting for it — sending a notification for an
  // entitlement that, by the time this transaction commits, has already
  // been revoked. `SELECT ... FOR UPDATE` on the exact rows those revoke
  // paths write forces this transaction to block until any such
  // concurrent writer finishes, then the ordinary read below (a fresh
  // statement, so a fresh READ COMMITTED snapshot) observes its outcome —
  // never a value that was already stale the moment it was read.
  await db.$queryRaw(Prisma.sql`
    SELECT id FROM entitlements
    WHERE "userId" = (SELECT "userId" FROM students WHERE id = ${input.studentId})
    FOR UPDATE
  `);

  const student = await db.student.findUnique({
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

  const origin = requiredPublicOrigin();
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

/**
 * `true` only for the specific outbox dedupe-key collision this module
 * expects from a genuine concurrent double-fire — never for an arbitrary
 * P2002 elsewhere in the same transaction (e.g. a bilan-level unique
 * constraint), which must still surface as a real failure rather than be
 * silently swallowed here.
 */
export function isDuplicateNotificationError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== PRISMA_UNIQUE_CONSTRAINT_VIOLATION) return false;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  const columns = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  return columns.includes(DEDUPE_KEY_CONSTRAINT_COLUMN);
}
