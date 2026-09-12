/**
 * Real notification, P7c: fires exactly once per real ARIA_PERIODIC bilan
 * publication — the caller (`PUT /api/bilans/[id]`) only invokes this
 * immediately after a real `isPublished: false -> true` write for that
 * type, never on a republish (already-published bilans never re-enter the
 * false->true branch, so this call site never re-fires — the dedupeKey
 * below is still a genuine DB-level backstop for a concurrent double-fire).
 *
 * Uses the real, already-connected `lib/email/outbox.ts` — never the
 * dormant `NotificationOutbox` (confirmed by the P7b audit fork to have no
 * producer or consumer anywhere in the codebase). Never includes
 * `parentsMarkdown`/`nexusMarkdown` — real pedagogical content stays behind
 * the authenticated parent detail page, never in the email body itself.
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { buildHumanRenderIdentity } from '@/lib/bilans/render/human-identity';
import { buildPeriodicBilanPublishedEmail } from './periodic-bilan-published-email';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export async function notifyParentPeriodicBilanPublished(input: {
  readonly bilanId: string;
  readonly studentId: string;
  readonly subject: string;
}): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: {
      user: { select: { firstName: true } },
      parent: { select: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
    },
  });
  const parentUser = student?.parent.user;
  const parentEmail = parentUser?.email?.trim();
  const studentFirstNameRaw = student?.user.firstName?.trim();
  const parentHasAnyName = Boolean(parentUser?.firstName?.trim() || parentUser?.lastName?.trim());
  if (!parentUser || !parentEmail || !studentFirstNameRaw || !parentHasAnyName) return;

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

  try {
    await prisma.$transaction(async (transaction) => {
      await enqueueEmailIntent(transaction, {
        aggregateId: parentUser.id,
        messageType: 'TRANSACTIONAL_NOTIFICATION',
        dedupeKey: `aria-periodic-bilan-published:${input.bilanId}`,
        to: parentEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
    ) {
      return; // already queued — a genuine concurrent double-fire, not a failure.
    }
    throw error;
  }
  kickEmailOutboxDrain();
}
