import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  AriaFeedbackRecord,
  AriaFeedbackRepository,
} from '../../application/feedback/public';
import { AriaError } from '../../errors';

class PrismaAriaFeedbackRepository implements AriaFeedbackRepository {
  constructor(private readonly client: PrismaClient) {}

  async upsertOwnedFeedback(input: Readonly<{
    actorUserId: string;
    messageId: string;
    useful: boolean;
    reason: string | null;
  }>): Promise<AriaFeedbackRecord> {
    const ownedMessage = await this.client.ariaMessage.findFirst({
      where: {
        id: input.messageId,
        conversation: { student: { userId: input.actorUserId } },
      },
      select: { id: true, conversation: { select: { studentId: true } } },
    });
    if (!ownedMessage) {
      throw new AriaError('NOT_ENTITLED', 403, 'Ce message ARIA n’est pas accessible.');
    }

    return this.client.ariaFeedback.upsert({
      where: {
        messageId_studentId: {
          messageId: ownedMessage.id,
          studentId: ownedMessage.conversation.studentId,
        },
      },
      create: {
        messageId: ownedMessage.id,
        studentId: ownedMessage.conversation.studentId,
        useful: input.useful,
        reason: input.reason,
      },
      update: {
        useful: input.useful,
        reason: input.reason,
      },
      select: {
        id: true,
        studentId: true,
        messageId: true,
        useful: true,
        reason: true,
        updatedAt: true,
      },
    });
  }
}

export const prismaAriaFeedbackRepository = new PrismaAriaFeedbackRepository(prisma);
