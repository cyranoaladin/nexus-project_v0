import type { AriaConversationContext } from './build-context';
import type { AriaConversationRepository, TurnCancellationRecord } from './ports';
import { requestLocalAriaTurnCancellation } from './cancellation-registry';

export interface CancelAriaConversationTurnInput {
  readonly context: AriaConversationContext;
  readonly turnId: string;
  readonly clientRequestId: string;
  readonly now?: Date;
}

export function makeCancelAriaConversationTurn(repository: AriaConversationRepository) {
  return async function cancelAriaConversationTurn(
    input: CancelAriaConversationTurnInput,
  ): Promise<TurnCancellationRecord> {
    const result = await repository.requestCancellation({
      turnId: input.turnId,
      actorUserId: input.context.actor.userId,
      subjectStudentId: input.context.subject.studentId,
      clientRequestId: input.clientRequestId,
      now: input.now ?? new Date(),
    });
    if (result.disposition === 'CANCELLATION_REQUESTED') {
      requestLocalAriaTurnCancellation(result.turnId, result.executionToken);
    }
    return result;
  };
}
