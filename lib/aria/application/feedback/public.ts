import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { prismaAriaFeedbackRepository } from '../../infrastructure/prisma/feedback-repository';

export const ARIA_FEEDBACK_CONCURRENCY_POLICY = 'LAST_COMMITTED_WRITE_WINS' as const;

export interface AriaFeedbackRecord {
  readonly id: string;
  readonly studentId: string;
  readonly messageId: string;
  readonly useful: boolean;
  readonly reason: string | null;
  readonly updatedAt: Date;
}

export interface AriaFeedbackRepository {
  upsertOwnedFeedback(input: Readonly<{
    actorUserId: string;
    messageId: string;
    useful: boolean;
    reason: string | null;
  }>): Promise<AriaFeedbackRecord>;
}

export interface RecordAriaFeedbackInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly messageId: string;
  readonly useful: boolean;
  readonly reason?: string | null;
}

export function makeRecordAriaFeedback(repository: AriaFeedbackRepository) {
  return async function recordAriaFeedback(input: RecordAriaFeedbackInput) {
    const actor = resolveInteractiveStudentActor(input.actor);
    const record = await repository.upsertOwnedFeedback({
      actorUserId: actor.userId,
      messageId: input.messageId,
      useful: input.useful,
      reason: input.reason?.trim() || null,
    });
    return Object.freeze({
      id: record.id,
      subjectStudentId: record.studentId,
      messageId: record.messageId,
      useful: record.useful,
      reason: record.reason,
      updatedAt: record.updatedAt.toISOString(),
    });
  };
}

export const recordAriaFeedbackForActor = makeRecordAriaFeedback(prismaAriaFeedbackRepository);
