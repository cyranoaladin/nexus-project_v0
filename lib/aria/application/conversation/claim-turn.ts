import { randomUUID } from 'node:crypto';
import type { AriaConversationContext } from './build-context';
import type { AriaConversationRepository, ClaimedTurnRecord } from './ports';
import { ARIA_TURN_LEASE_MS } from '../../domain/conversation/lifecycle-policy';

export interface ClaimAriaConversationTurnInput {
  readonly context: AriaConversationContext;
  readonly turnId: string;
  readonly conversationId?: string;
  readonly now?: Date;
}

export function makeClaimAriaConversationTurn(repository: AriaConversationRepository) {
  return async function claimAriaConversationTurn(
    input: ClaimAriaConversationTurnInput,
  ): Promise<ClaimedTurnRecord> {
    const now = input.now ?? new Date();
    return repository.claimTurn({
      turnId: input.turnId,
      conversationId: input.conversationId ?? input.context.conversation?.id ?? '',
      actorUserId: input.context.actor.userId,
      subjectStudentId: input.context.subject.studentId,
      executionToken: randomUUID(),
      now,
      leaseExpiresAt: new Date(now.getTime() + ARIA_TURN_LEASE_MS),
    });
  };
}
