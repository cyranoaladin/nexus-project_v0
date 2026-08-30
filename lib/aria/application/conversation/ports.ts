import type { AriaTurnStatus } from '../../domain/conversation/turn-state';
import type { AriaHistoryTurn } from '../../domain/conversation/history-budget';
import type { AriaRagStatus } from '../../domain/retrieval/policy';
import type {
  AriaGroundingHit,
  AriaTurnRetrievalAudit,
} from './retrieval-evidence';

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

export interface CheckpointTurnRetrievalInput {
  readonly turnId: string;
  readonly conversationId: string;
  readonly executionToken: string;
  readonly ragStatus: AriaRagStatus;
  readonly retrievalPolicy: Readonly<Record<string, unknown>>;
  readonly retrievalEvidence: AriaTurnRetrievalAudit;
  readonly policyVersion: string;
}

export interface FinalizeTurnInput {
  readonly turnId: string;
  readonly conversationId: string;
  readonly assistantMessageId: string;
  readonly executionToken: string;
  readonly status: 'COMPLETED' | 'CANCELLED' | 'ERROR';
  readonly content: string;
  readonly ragStatus: AriaRagStatus;
  readonly retrievalEvidence: AriaTurnRetrievalAudit;
  readonly citations: readonly AriaGroundingHit[];
  readonly executionMetadata: Readonly<Record<string, unknown>>;
  readonly now?: Date;
}

export interface LoadTurnResultInput {
  readonly turnId: string;
  readonly actorUserId: string;
  readonly subjectStudentId: string;
}

export interface PersistedTurnResult {
  readonly turnId: string;
  readonly conversationId: string;
  readonly assistantMessageId: string;
  readonly status: AriaTurnStatus;
  readonly content: string;
  readonly ragStatus?: AriaRagStatus;
  readonly citations: readonly AriaGroundingHit[];
}

export interface RequestTurnCancellationInput {
  readonly turnId: string;
  readonly actorUserId: string;
  readonly subjectStudentId: string;
  readonly clientRequestId: string;
  readonly now: Date;
}

export interface TurnCancellationRecord {
  readonly turnId: string;
  readonly conversationId: string;
  readonly status: AriaTurnStatus;
  readonly executionToken?: string;
  readonly disposition: 'CANCELLED' | 'CANCELLATION_REQUESTED' | 'TERMINAL_REPLAY';
}

export interface HeartbeatTurnInput {
  readonly turnId: string;
  readonly conversationId: string;
  readonly executionToken: string;
  readonly now: Date;
  readonly leaseExpiresAt: Date;
}

export interface HeartbeatTurnRecord {
  readonly disposition: 'RENEWED' | 'CANCELLATION_REQUESTED' | 'LEASE_LOST';
}

export interface AriaConversationRepository {
  reserveTurn(input: ReserveTurnRepositoryInput): Promise<ReservedTurnRecord>;
  claimTurn(input: ClaimTurnRepositoryInput): Promise<ClaimedTurnRecord>;
  loadRecentCompletedTurns(input: {
    readonly conversationId: string;
    readonly subjectStudentId: string;
    readonly maxTurns: number;
  }): Promise<readonly AriaHistoryTurn[]>;
  checkpointRetrieval(input: CheckpointTurnRetrievalInput): Promise<void>;
  finalizeTurn(input: FinalizeTurnInput): Promise<void>;
  loadTurnResult(input: LoadTurnResultInput): Promise<PersistedTurnResult>;
  requestCancellation(input: RequestTurnCancellationInput): Promise<TurnCancellationRecord>;
  heartbeatTurn(input: HeartbeatTurnInput): Promise<HeartbeatTurnRecord>;
}
