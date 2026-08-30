import { randomUUID } from 'node:crypto';
import { AriaError, type AriaErrorCode } from '../../kernel/errors';
import type { AriaConversationContext } from './build-context';
import type { AriaConversationRepository } from './ports';
import { makeReserveAriaConversationTurn } from './reserve-turn';
import {
  DEFAULT_ARIA_HISTORY_BUDGET,
  selectAriaPromptHistory,
} from '../../domain/conversation/history-budget';
import {
  decideAriaRetrievalOutcome,
  resolveAriaRetrievalPolicy,
  type AriaRagStatus,
  type ResolvedAriaRetrievalPolicy,
} from '../../domain/retrieval/policy';
import type { AriaPedagogicalMode } from '../../domain/pedagogy/pedagogical-mode';
import type { FormattedPromptMessage } from './build-prompt';
import {
  createAriaTurnRetrievalAudit,
  type AriaCanonicalRetrievalOutcome,
  type AriaGroundingHit,
  type AriaTurnRetrievalAudit,
} from './retrieval-evidence';
import {
  registerAriaTurnCancellation,
  requestLocalAriaTurnCancellation,
  unregisterAriaTurnCancellation,
} from './cancellation-registry';
import { startAriaTurnHeartbeat } from './turn-heartbeat';
import {
  ARIA_TURN_HEARTBEAT_INTERVAL_MS,
  ARIA_TURN_LEASE_MS,
} from '../../domain/conversation/lifecycle-policy';

const MAX_GENERATED_CHARACTERS = 64 * 1024;

export interface RunAriaConversationInput {
  readonly context: AriaConversationContext;
  readonly clientRequestId: string;
  readonly message: string;
  readonly pedagogicalMode?: AriaPedagogicalMode;
  readonly agentRole?: 'TUTOR';
  readonly onStart?: (event: AriaConversationStartEvent) => void;
  readonly onDelta?: (text: string) => void;
  readonly onComplete?: (result: AriaConversationExecutionResult) => void | Promise<void>;
}

export interface AriaConversationStartEvent {
  readonly turnId: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
  readonly disposition: 'IN_PROGRESS' | 'REPLAY' | 'EXECUTED';
}

export interface AriaConversationExecutionResult {
  readonly turnId: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
  readonly disposition: 'IN_PROGRESS' | 'REPLAY' | 'EXECUTED';
  readonly fullText: string;
  readonly ragStatus?: AriaRagStatus;
  readonly citations: readonly AriaGroundingHit[];
  readonly failureCode?: AriaErrorCode;
}

export interface AriaConversationExecutionDependencies {
  readonly repository: AriaConversationRepository;
  readonly retrieve: (input: {
    readonly context: AriaConversationContext;
    readonly policy: ResolvedAriaRetrievalPolicy;
    readonly query: string;
  }) => Promise<AriaCanonicalRetrievalOutcome>;
  readonly buildPrompt: (input: {
    readonly context: AriaConversationContext;
    readonly mode: AriaPedagogicalMode;
    readonly agentRole: 'TUTOR';
    readonly policy: ResolvedAriaRetrievalPolicy;
    readonly ragStatus: AriaRagStatus;
    readonly citations: readonly AriaGroundingHit[];
    readonly history: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
    readonly message: string;
  }) => readonly FormattedPromptMessage[];
  readonly streamModel: (
    messages: readonly FormattedPromptMessage[],
    options: { readonly signal: AbortSignal },
  ) => AsyncIterable<string>;
  readonly now: () => Date;
  readonly createExecutionToken: () => string;
}

function terminalExecutionMetadata(input: {
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly policy: ResolvedAriaRetrievalPolicy;
  readonly reasonCode?: string;
  readonly downgradeReason?: string;
}): Readonly<Record<string, unknown>> {
  return {
    durationMs: Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime()),
    retrievalPolicy: input.policy.kind,
    retrievalPolicyVersion: input.policy.policyVersion,
    ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    ...(input.downgradeReason ? { downgradeReason: input.downgradeReason } : {}),
  };
}

function emptyAudit(): AriaTurnRetrievalAudit {
  return { schemaVersion: 1, hits: [] };
}

function abortError(signal: AbortSignal): AriaError {
  if (signal.reason === 'USER_CANCELLED') {
    return new AriaError('USER_CANCELLED', 499, 'Génération ARIA annulée.');
  }
  return new AriaError('INTERNAL_ERROR', 500, 'L’exécution ARIA a perdu son verrou.', {
    reasonCode: signal.reason === 'TURN_LEASE_LOST'
      ? 'TURN_LEASE_LOST'
      : 'TURN_HEARTBEAT_FAILED',
  });
}

export function makeRunAriaConversation(dependencies: AriaConversationExecutionDependencies) {
  const reserveTurn = makeReserveAriaConversationTurn(dependencies.repository);

  return async function runAriaConversation(
    input: RunAriaConversationInput,
  ): Promise<AriaConversationExecutionResult> {
    const message = input.message.trim();
    if (!message) throw new AriaError('BAD_REQUEST', 400, 'Le message ne peut pas être vide.');
    const mode = input.pedagogicalMode ?? 'DISCOVERY';
    const agentRole = input.agentRole ?? 'TUTOR';
    const reserved = await reserveTurn({
      context: input.context,
      clientRequestId: input.clientRequestId,
      message,
      pedagogicalMode: mode,
      agentRole,
      now: dependencies.now(),
    });

    if (reserved.disposition === 'IN_PROGRESS') {
      const result: AriaConversationExecutionResult = {
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        messageId: reserved.assistantMessageId,
        status: reserved.status,
        disposition: 'IN_PROGRESS',
        fullText: '',
        citations: [],
      };
      input.onStart?.({
        turnId: result.turnId, conversationId: result.conversationId,
        messageId: result.messageId, status: result.status, disposition: result.disposition,
      });
      return result;
    }
    if (reserved.disposition === 'REPLAY') {
      const replay = await dependencies.repository.loadTurnResult({
        turnId: reserved.turnId,
        actorUserId: input.context.actor.userId,
        subjectStudentId: input.context.subject.studentId,
      });
      const result: AriaConversationExecutionResult = {
        turnId: replay.turnId,
        conversationId: replay.conversationId,
        messageId: replay.assistantMessageId,
        status: replay.status as 'COMPLETED' | 'CANCELLED' | 'ERROR',
        disposition: 'REPLAY',
        fullText: replay.content,
        ragStatus: replay.ragStatus,
        citations: replay.citations,
        failureCode: replay.failureCode,
      };
      input.onStart?.({
        turnId: result.turnId, conversationId: result.conversationId,
        messageId: result.messageId, status: result.status, disposition: result.disposition,
      });
      return result;
    }

    const executionToken = dependencies.createExecutionToken();
    const claimNow = dependencies.now();
    const claimed = await dependencies.repository.claimTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      actorUserId: input.context.actor.userId,
      subjectStudentId: input.context.subject.studentId,
      executionToken,
      now: claimNow,
      leaseExpiresAt: new Date(claimNow.getTime() + ARIA_TURN_LEASE_MS),
    });
    if (claimed.disposition !== 'CLAIMED' || claimed.executionToken !== executionToken) {
      const result: AriaConversationExecutionResult = {
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        messageId: reserved.assistantMessageId,
        status: claimed.status,
        disposition: 'IN_PROGRESS',
        fullText: '',
        citations: [],
      };
      input.onStart?.({
        turnId: result.turnId, conversationId: result.conversationId,
        messageId: result.messageId, status: result.status, disposition: result.disposition,
      });
      return result;
    }

    input.onStart?.({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      messageId: reserved.assistantMessageId,
      status: 'RUNNING',
      disposition: 'EXECUTED',
    });

    const cancellationSignal = registerAriaTurnCancellation(reserved.turnId, executionToken);
    const heartbeat = startAriaTurnHeartbeat({
      heartbeat: () => {
        const heartbeatNow = dependencies.now();
        return dependencies.repository.heartbeatTurn({
          turnId: reserved.turnId,
          conversationId: reserved.conversationId,
          executionToken,
          now: heartbeatNow,
          leaseExpiresAt: new Date(heartbeatNow.getTime() + ARIA_TURN_LEASE_MS),
        });
      },
      abort: (reason) => {
        requestLocalAriaTurnCancellation(reserved.turnId, executionToken, reason);
      },
      intervalMs: ARIA_TURN_HEARTBEAT_INTERVAL_MS,
    });
    const startedAt = dependencies.now();
    let ragStatus: AriaRagStatus = 'NOT_CONFIGURED';
    let audit = emptyAudit();
    let hits: readonly AriaGroundingHit[] = [];
    let accumulated = '';
    let policy: ResolvedAriaRetrievalPolicy | undefined;
    let downgradeReason: string | undefined;
    let finalizationAttempted = false;

    try {
      const historyTurns = await dependencies.repository.loadRecentCompletedTurns({
        conversationId: reserved.conversationId,
        subjectStudentId: input.context.subject.studentId,
        maxTurns: DEFAULT_ARIA_HISTORY_BUDGET.maxCandidateTurns,
      });
      const history = selectAriaPromptHistory(historyTurns, DEFAULT_ARIA_HISTORY_BUDGET);
      policy = resolveAriaRetrievalPolicy({
        task: mode,
        courseKey: input.context.courseKey,
        agentRole,
        visibility: 'STUDENT_PRIVATE',
        capabilities: input.context.capabilities,
      });
      if (policy.kind === 'NO_MODEL') {
        throw new AriaError('UNSUPPORTED', 422, 'Le modèle ARIA n’est pas disponible pour ce contexte.');
      }
      const retrieval = await dependencies.retrieve({ context: input.context, policy, query: message });
      if (cancellationSignal.aborted) throw abortError(cancellationSignal);
      ragStatus = retrieval.status;
      hits = retrieval.hits;
      audit = createAriaTurnRetrievalAudit(retrieval);
      await dependencies.repository.checkpointRetrieval({
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        executionToken,
        ragStatus,
        retrievalPolicy: {
          kind: policy.kind,
          reasonCode: policy.reasonCode,
          task: policy.task,
          agentRole: policy.agentRole,
          visibility: policy.visibility,
        },
        retrievalEvidence: audit,
        policyVersion: policy.policyVersion,
      });
      const decision = decideAriaRetrievalOutcome(policy, retrieval);
      downgradeReason = decision.downgradeReason;
      if (!decision.allowModel) {
        throw new AriaError('UNSUPPORTED', 422, 'Le modèle ARIA est désactivé par la politique.');
      }
      const citations = decision.grounded ? hits : [];
      const prompt = dependencies.buildPrompt({
        context: input.context,
        mode,
        agentRole,
        policy,
        ragStatus,
        citations,
        history,
        message,
      });
      for await (const token of dependencies.streamModel(prompt, { signal: cancellationSignal })) {
        if (cancellationSignal.aborted) {
          throw abortError(cancellationSignal);
        }
        if (accumulated.length + token.length > MAX_GENERATED_CHARACTERS) {
          throw new AriaError('MODEL_UNAVAILABLE', 503, 'La sortie du modèle ARIA dépasse la limite autorisée.', {
            reasonCode: 'MODEL_OUTPUT_LIMIT_EXCEEDED',
          });
        }
        accumulated += token;
        input.onDelta?.(token);
      }
      if (cancellationSignal.aborted) {
        throw abortError(cancellationSignal);
      }

      finalizationAttempted = true;
      await dependencies.repository.finalizeTurn({
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        assistantMessageId: reserved.assistantMessageId,
        executionToken,
        status: 'COMPLETED',
        content: accumulated,
        ragStatus,
        retrievalEvidence: audit,
        citations,
        executionMetadata: terminalExecutionMetadata({
          startedAt,
          finishedAt: dependencies.now(),
          policy,
          downgradeReason,
        }),
      });
      const result: AriaConversationExecutionResult = {
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        messageId: reserved.assistantMessageId,
        status: 'COMPLETED',
        disposition: 'EXECUTED',
        fullText: accumulated,
        ragStatus,
        citations,
      };
      await input.onComplete?.(result);
      return result;
    } catch (error: unknown) {
      if (finalizationAttempted) throw error;
      const cancelled = error instanceof AriaError && error.code === 'USER_CANCELLED';
      const failureCode: AriaErrorCode = error instanceof AriaError
        ? error.code
        : 'INTERNAL_ERROR';
      const terminalStatus = cancelled ? 'CANCELLED' : 'ERROR';
      const citations = accumulated && hits.length > 0 ? hits : [];
      finalizationAttempted = true;
      await dependencies.repository.finalizeTurn({
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        assistantMessageId: reserved.assistantMessageId,
        executionToken,
        status: terminalStatus,
        content: accumulated,
        ragStatus,
        retrievalEvidence: audit,
        citations,
        executionMetadata: {
          failureCode,
          ...(policy ? terminalExecutionMetadata({
            startedAt,
            finishedAt: dependencies.now(),
            policy,
            reasonCode: error instanceof AriaError ? error.code : 'INTERNAL_ERROR',
            downgradeReason,
          }) : { reasonCode: 'PRE_POLICY_FAILURE' }),
        },
      });
      if (cancelled) {
        const cancelledResult: AriaConversationExecutionResult = {
          turnId: reserved.turnId,
          conversationId: reserved.conversationId,
          messageId: reserved.assistantMessageId,
          status: 'CANCELLED',
          disposition: 'EXECUTED',
          fullText: accumulated,
          ragStatus,
          citations,
        };
        await input.onComplete?.(cancelledResult);
        return cancelledResult;
      }
      const failedResult: AriaConversationExecutionResult = {
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        messageId: reserved.assistantMessageId,
        status: 'ERROR',
        disposition: 'EXECUTED',
        fullText: accumulated,
        ragStatus,
        citations,
        failureCode,
      };
      await input.onComplete?.(failedResult);
      return failedResult;
    } finally {
      await heartbeat.stop();
      unregisterAriaTurnCancellation(reserved.turnId, executionToken);
    }
  };
}

export const createAriaExecutionToken = randomUUID;
