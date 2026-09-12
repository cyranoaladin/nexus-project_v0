/**
 * Real notification, P7c: fires exactly once per real, due workshop
 * reminder — called only by `queueDueAriaWorkshopReminders` after it has
 * atomically claimed the attendee row (a conditional
 * `WHERE reminderQueuedAt IS NULL` update), so a genuine concurrent
 * double-fire across replicas is already excluded before this function is
 * ever called. `enqueueEmailIntent`'s own DB-unique `idempotencyKey` is
 * still a second, independent backstop.
 *
 * Uses the real, already-connected `lib/email/outbox.ts` — never the
 * dormant `NotificationOutbox`.
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { buildHumanRenderIdentity } from '@/lib/bilans/render/human-identity';
import { buildWorkshopReminderEmail } from './workshop-reminder-email';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export async function notifyParentWorkshopReminder(input: {
  readonly studentId: string;
  readonly sessionId: string;
  readonly workshopTitle: string;
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly location: string | null;
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

  const message = buildWorkshopReminderEmail({
    parentDisplayName,
    studentFirstName,
    workshopTitle: input.workshopTitle,
    scheduledDateLabel: input.scheduledDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    dashboardUrl: `${origin}/dashboard/parent/enfant/${input.studentId}`,
  });

  try {
    await prisma.$transaction(async (transaction) => {
      await enqueueEmailIntent(transaction, {
        aggregateId: parentUser.id,
        messageType: 'TRANSACTIONAL_NOTIFICATION',
        dedupeKey: `aria-workshop-reminder:${input.sessionId}:${input.studentId}`,
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
