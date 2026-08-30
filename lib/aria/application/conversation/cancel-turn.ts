import type { AriaConversationRepository, TurnCancellationRecord } from './ports';
import { requestLocalAriaTurnCancellation } from './cancellation-registry';
import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';

export interface CancelAriaConversationTurnInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly turnId: string;
  readonly clientRequestId: string;
  readonly now?: Date;
}

export function makeCancelAriaConversationTurn(repository: AriaConversationRepository) {
  return async function cancelAriaConversationTurn(
    input: CancelAriaConversationTurnInput,
  ): Promise<TurnCancellationRecord> {
    const actor = resolveInteractiveStudentActor(input.actor);
    const result = await repository.requestCancellation({
      turnId: input.turnId,
      actorUserId: actor.userId,
      clientRequestId: input.clientRequestId,
      now: input.now ?? new Date(),
    });
    if (result.disposition === 'CANCELLATION_REQUESTED') {
      requestLocalAriaTurnCancellation(result.turnId, result.executionToken);
    }
    return result;
  };
}
