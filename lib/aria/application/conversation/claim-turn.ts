import { randomUUID } from 'node:crypto';
import type { AriaConversationContext } from './build-context';
import type { AriaConversationRepository, ClaimedTurnRecord } from './ports';
import { ARIA_TURN_LEASE_MS } from '../../domain/conversation/lifecycle-policy';
import { AriaError } from '../../errors';

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
    const conversationId = input.conversationId ?? input.context.conversation?.id;
    if (!conversationId) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Le Turn ARIA ne référence aucune conversation.');
    }
    return repository.claimTurn({
      turnId: input.turnId,
      conversationId,
      actorUserId: input.context.actor.userId,
      subjectStudentId: input.context.subject.studentId,
      executionToken: randomUUID(),
      now,
      leaseExpiresAt: new Date(now.getTime() + ARIA_TURN_LEASE_MS),
    });
  };
}
