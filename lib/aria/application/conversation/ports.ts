import type { AriaTurnStatus } from '../../domain/conversation/turn-state';
import type { AriaHistoryTurn } from '../../domain/conversation/history-budget';

export interface ReserveTurnRepositoryInput {
  readonly actorUserId: string;
  readonly subjectStudentId: string;
  readonly clientRequestId: string;
  readonly requestFingerprint: string;
  readonly requestedConversationId?: string;
  readonly courseKey: string;
  readonly skillId?: string;
  readonly resourceId?: string;
  readonly message: string;
  readonly academicSnapshot: Readonly<Record<string, unknown>>;
  readonly pedagogicalMode: string;
  readonly agentRole: string;
  readonly now: Date;
  readonly pendingRecoveryAt: Date;
}

export interface ReservedTurnRecord {
  readonly turnId: string;
  readonly conversationId: string;
  readonly userMessageId: string;
  readonly assistantMessageId: string;
  readonly status: AriaTurnStatus;
  readonly disposition: 'RESERVED' | 'IN_PROGRESS' | 'REPLAY';
}

export interface ClaimTurnRepositoryInput {
  readonly turnId: string;
  readonly conversationId: string;
  readonly actorUserId: string;
  readonly subjectStudentId: string;
  readonly executionToken: string;
  readonly now: Date;
  readonly leaseExpiresAt: Date;
}

export interface ClaimedTurnRecord {
  readonly turnId: string;
  readonly conversationId: string;
  readonly status: AriaTurnStatus;
  readonly executionToken?: string;
  readonly leaseExpiresAt?: Date;
  readonly disposition: 'CLAIMED' | 'NOT_CLAIMED';
}

export interface AriaConversationRepository {
  reserveTurn(input: ReserveTurnRepositoryInput): Promise<ReservedTurnRecord>;
  claimTurn(input: ClaimTurnRepositoryInput): Promise<ClaimedTurnRecord>;
  loadRecentCompletedTurns(input: {
    readonly conversationId: string;
    readonly subjectStudentId: string;
    readonly maxTurns: number;
  }): Promise<readonly AriaHistoryTurn[]>;
}
