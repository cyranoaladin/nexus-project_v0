/** One durable email intent per workshop admission; delivery is retried separately. */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { buildHumanRenderIdentity } from '@/lib/bilans/render/human-identity';
import { buildWorkshopRegisteredEmail } from './workshop-registered-email';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

type WorkshopRegisteredNotificationInput = {
  readonly studentId: string;
  readonly sessionId: string;
  readonly workshopTitle: string;
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly location: string | null;
};

/** Caller owns the admission transaction; enqueue errors must roll it back. */
export async function enqueueParentWorkshopRegistered(
  transaction: Pick<Prisma.TransactionClient, 'student' | 'jobOutbox'>,
  input: WorkshopRegisteredNotificationInput,
): Promise<void> {
  const student = await transaction.student.findUnique({
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

  const message = buildWorkshopRegisteredEmail({
    parentDisplayName,
    studentFirstName,
    workshopTitle: input.workshopTitle,
    scheduledDateLabel: input.scheduledDate.toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis', day: 'numeric', month: 'long', year: 'numeric' }),
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    dashboardUrl: `${origin}/dashboard/parent/enfant/${input.studentId}`,
  });

  await enqueueEmailIntent(transaction, {
    aggregateId: parentUser.id,
    messageType: 'TRANSACTIONAL_NOTIFICATION',
    dedupeKey: `aria-workshop-registered:${input.sessionId}:${input.studentId}`,
    to: parentEmail,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

/** Standalone retry producer retained for existing callers. */
export async function notifyParentWorkshopRegistered(input: WorkshopRegisteredNotificationInput): Promise<void> {
  try {
    await prisma.$transaction(tx => enqueueParentWorkshopRegistered(tx, input));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION) return;
    throw error;
  }
  kickEmailOutboxDrain();
}
