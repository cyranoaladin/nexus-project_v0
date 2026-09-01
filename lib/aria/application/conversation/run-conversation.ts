import { AriaError, type AriaErrorCode } from '../../kernel/errors';
import type { AriaConversationContext } from './build-context';
import type {
  AriaConversationAdmissionPort,
  AriaConversationRepository,
} from './ports';
import {
  fingerprintAriaTurnRequest,
  makeReserveAriaConversationTurn,
} from './reserve-turn';
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
  canonicalizeAriaGroundingHit,
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
import { ARIA_PERFORMANCE_BUDGETS } from '../../domain/observability/performance-budgets';
import {
  classifyAriaLatency,
  recordAriaTelemetry,
  type AriaConversationTelemetryEvent,
  type AriaConversationTelemetrySink,
} from '../../domain/observability/telemetry';

const MAX_GENERATED_CHARACTERS = ARIA_PERFORMANCE_BUDGETS.modelOutputCharactersMax;

export interface RunAriaConversationInput {
  readonly requestId: string;
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

export interface AriaModelFallbackObservation {
  readonly reasonCode: 'PRIMARY_PROVIDER_UNAVAILABLE';
}

export interface AriaConversationExecutionDependencies {
  readonly repository: AriaConversationRepository;
  readonly admission: AriaConversationAdmissionPort;
  readonly retrieve: (input: {
    readonly context: AriaConversationContext;
    readonly policy: ResolvedAriaRetrievalPolicy;
    readonly query: string;
    readonly signal: AbortSignal;
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
    options: {
      readonly signal: AbortSignal;
      readonly onFallback?: (event: AriaModelFallbackObservation) => void;
    },
  ) => AsyncIterable<string>;
  readonly now: () => Date;
  readonly createExecutionToken: () => string;
  readonly monotonicNow: () => number;
  readonly modelPolicy: string;
  readonly telemetry: AriaConversationTelemetrySink;
}

function terminalExecutionMetadata(input: {
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly policy: ResolvedAriaRetrievalPolicy;
  readonly reasonCode?: string;
  readonly downgradeReason?: string;
  readonly ragLatencyMs?: number;
  readonly timeToFirstTokenMs?: number;
  readonly generationDurationMs?: number;
  readonly modelFallback?: AriaModelFallbackObservation;
}): Readonly<Record<string, unknown>> {
  return {
    durationMs: Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime()),
    retrievalPolicy: input.policy.kind,
    retrievalPolicyVersion: input.policy.policyVersion,
    ...(input.ragLatencyMs !== undefined ? { ragLatencyMs: input.ragLatencyMs } : {}),
    ...(input.timeToFirstTokenMs !== undefined
      ? { timeToFirstTokenMs: input.timeToFirstTokenMs }
      : {}),
    ...(input.generationDurationMs !== undefined
      ? { generationDurationMs: input.generationDurationMs }
      : {}),
    ...(input.modelFallback ? { modelFallback: input.modelFallback } : {}),
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

function executionReasonCode(error: unknown, fallback: AriaErrorCode): string {
  if (!(error instanceof AriaError)
    || !error.internalDetails
    || typeof error.internalDetails !== 'object') return fallback;
  const reasonCode = (error.internalDetails as Record<string, unknown>).reasonCode;
  return typeof reasonCode === 'string' && /^[A-Z0-9_]{1,80}$/.test(reasonCode)
    ? reasonCode
    : fallback;
}

type AriaAdmissionFailureCode =
  | 'RATE_LIMIT_EXCEEDED'
  | 'RATE_LIMIT_BACKEND_UNAVAILABLE';

function admissionFailure(code: AriaAdmissionFailureCode): AriaError {
  return code === 'RATE_LIMIT_EXCEEDED'
    ? new AriaError(code, 429, 'Trop de générations ARIA ont été demandées.')
    : new AriaError(code, 503, 'Le contrôle de disponibilité ARIA est indisponible.');
}

function resolveRequestedResourceContext(
  context: AriaConversationContext,
): { readonly resourceId: string; readonly resourceVersionId: string } | undefined {
  const { resourceId, resourceVersionId } = context;
  if (resourceId === undefined && resourceVersionId === undefined) return undefined;
  if (!resourceId || !resourceVersionId) {
    throw new AriaError(
      'INTERNAL_ERROR',
      500,
      'Le contexte ressource ARIA est incomplet.',
      { reasonCode: 'RESOURCE_VERSION_CONTEXT_INCOMPLETE' },
    );
  }
  return { resourceId, resourceVersionId };
}

export function makeRunAriaConversation(dependencies: AriaConversationExecutionDependencies) {
  const reserveTurn = makeReserveAriaConversationTurn(dependencies.repository);

  return async function runAriaConversation(
    input: RunAriaConversationInput,
  ): Promise<AriaConversationExecutionResult> {
    const applicationStartedAt = dependencies.monotonicNow();
    const message = input.message.trim();
    if (!message) throw new AriaError('BAD_REQUEST', 400, 'Le message ne peut pas être vide.');
    const requestedResource = resolveRequestedResourceContext(input.context);
    const mode = input.pedagogicalMode ?? 'DISCOVERY';
    const agentRole = input.agentRole ?? 'TUTOR';
    const reservationRequest = {
      context: input.context,
      clientRequestId: input.clientRequestId,
      message,
      pedagogicalMode: mode,
      agentRole,
      modelPolicy: { policyId: dependencies.modelPolicy },
    } as const;
    let reserved = await dependencies.repository.findTurnReservation({
      actorUserId: input.context.actor.userId,
      subjectStudentId: input.context.subject.studentId,
      clientRequestId: input.clientRequestId,
      requestFingerprint: fingerprintAriaTurnRequest(reservationRequest),
    });
    if (!reserved) {
      let admission;
      try {
        admission = await dependencies.admission.admitExecution({
          actorUserId: input.context.actor.userId,
          requestId: input.requestId,
          clientRequestId: input.clientRequestId,
        });
      } catch {
        admission = { status: 'UNAVAILABLE' as const };
      }
      if (admission.status !== 'ALLOWED') {
        throw admissionFailure(
          admission.status === 'DENIED'
            ? 'RATE_LIMIT_EXCEEDED'
            : 'RATE_LIMIT_BACKEND_UNAVAILABLE',
        );
      }
      reserved = await reserveTurn({ ...reservationRequest, now: dependencies.now() });
    }
    const modeContext = {
      requestId: input.requestId,
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      courseKey: input.context.courseKey,
      pedagogicalMode: mode,
      agentRole,
      visibility: 'STUDENT_PRIVATE' as const,
      modelPolicy: dependencies.modelPolicy,
    };
    const elapsed = (startedAt: number) => Math.max(0, dependencies.monotonicNow() - startedAt);
    const emit = (
      event: AriaConversationTelemetryEvent['event'],
      durationMs: number,
      details: Partial<Pick<
        AriaConversationTelemetryEvent,
        'ragStatus' | 'timeToFirstTokenMs' | 'finalState' | 'reasonCode'
      >>,
    ) => {
      const latencyOperation = event === 'RETRIEVAL'
        ? 'RETRIEVAL' as const
        : event === 'MODEL'
          ? 'MODEL_TOTAL' as const
          : event === 'FINALIZE'
            ? 'FINALIZE' as const
            : 'MODEL_TOTAL' as const;
      recordAriaTelemetry(dependencies.telemetry, {
        schemaVersion: 1,
        event,
        ...modeContext,
        durationMs,
        latencyClass: classifyAriaLatency(latencyOperation, durationMs),
        ...details,
      });
    };
    emit('START', elapsed(applicationStartedAt), { finalState: reserved.status });

    const replayPersistedTurn = async (): Promise<AriaConversationExecutionResult> => {
      const replay = await dependencies.repository.loadTurnResult({
        turnId: reserved.turnId,
        actorUserId: input.context.actor.userId,
        subjectStudentId: input.context.subject.studentId,
      });
      if (replay.failureCode === 'RATE_LIMIT_EXCEEDED'
        || replay.failureCode === 'RATE_LIMIT_BACKEND_UNAVAILABLE') {
        throw admissionFailure(replay.failureCode);
      }
      const status = replay.status as 'COMPLETED' | 'CANCELLED' | 'ERROR';
      const result: AriaConversationExecutionResult = {
        turnId: replay.turnId,
        conversationId: replay.conversationId,
        messageId: replay.assistantMessageId,
        status,
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
      emit(
        status === 'CANCELLED' ? 'CANCELLED' : status === 'ERROR' ? 'ERROR' : 'COMPLETED',
        elapsed(applicationStartedAt),
        {
          ...(replay.ragStatus ? { ragStatus: replay.ragStatus } : {}),
          finalState: status,
          ...(replay.failureCode ? { reasonCode: replay.failureCode } : {}),
        },
      );
      return result;
    };

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
      return replayPersistedTurn();
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
      if (claimed.status === 'COMPLETED'
        || claimed.status === 'CANCELLED'
        || claimed.status === 'ERROR') {
        return replayPersistedTurn();
      }
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
    let ragLatencyMs: number | undefined;
    let modelStartedAt: number | undefined;
    let timeToFirstTokenMs: number | undefined;
    let generationDurationMs: number | undefined;
    let modelTelemetryEmitted = false;
    let modelFallback: AriaModelFallbackObservation | undefined;

    const emitModel = (reasonCode?: string) => {
      if (modelStartedAt === undefined || modelTelemetryEmitted) return;
      generationDurationMs = elapsed(modelStartedAt);
      emit('MODEL', generationDurationMs, {
        ragStatus,
        ...(timeToFirstTokenMs !== undefined ? { timeToFirstTokenMs } : {}),
        ...(reasonCode ? { reasonCode } : {}),
      });
      modelTelemetryEmitted = true;
    };

    const finalize = async (parameters: Parameters<AriaConversationRepository['finalizeTurn']>[0]) => {
      const finalizeStartedAt = dependencies.monotonicNow();
      try {
        await dependencies.repository.finalizeTurn(parameters);
      } catch (error: unknown) {
        emit('ERROR', elapsed(applicationStartedAt), {
          ragStatus,
          finalState: 'ERROR',
          reasonCode: 'FINALIZATION_FAILED',
        });
        throw error;
      }
      emit('FINALIZE', elapsed(finalizeStartedAt), {
        ragStatus,
        finalState: parameters.status,
      });
    };

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
        ...(requestedResource ? { requestedResource } : {}),
        agentRole,
        visibility: 'STUDENT_PRIVATE',
        capabilities: input.context.capabilities,
      });
      if (policy.kind === 'NO_MODEL') {
        throw new AriaError('UNSUPPORTED', 422, 'Le modèle ARIA n’est pas disponible pour ce contexte.');
      }
      const retrievalStartedAt = dependencies.monotonicNow();
      const retrieval = await dependencies.retrieve({
        context: input.context,
        policy,
        query: message,
        signal: cancellationSignal,
      });
      ragLatencyMs = elapsed(retrievalStartedAt);
      ragStatus = retrieval.status;
      emit('RETRIEVAL', ragLatencyMs, {
        ragStatus,
        ...(retrieval.failureReason ? { reasonCode: retrieval.failureReason } : {}),
      });
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
          ...(policy.requestedResource
            ? { requestedResource: policy.requestedResource }
            : {}),
          ...(retrieval.failureReason ? { failureReason: retrieval.failureReason } : {}),
        },
        retrievalEvidence: audit,
        policyVersion: policy.policyVersion,
      });
      if (cancellationSignal.aborted) throw abortError(cancellationSignal);
      hits = retrieval.hits.map((hit) => canonicalizeAriaGroundingHit(
        hit,
        input.context.courseKey,
      ));
      const decision = decideAriaRetrievalOutcome(policy, { ...retrieval, hits });
      downgradeReason = decision.downgradeReason;
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
      modelStartedAt = dependencies.monotonicNow();
      for await (const token of dependencies.streamModel(prompt, {
        signal: cancellationSignal,
        onFallback: (event) => {
          modelFallback ??= event;
        },
      })) {
        if (cancellationSignal.aborted) {
          throw abortError(cancellationSignal);
        }
        if (accumulated.length + token.length > MAX_GENERATED_CHARACTERS) {
          throw new AriaError('MODEL_UNAVAILABLE', 503, 'La sortie du modèle ARIA dépasse la limite autorisée.', {
            reasonCode: 'MODEL_OUTPUT_LIMIT_EXCEEDED',
          });
        }
        if (timeToFirstTokenMs === undefined) timeToFirstTokenMs = elapsed(modelStartedAt);
        accumulated += token;
        input.onDelta?.(token);
      }
      if (cancellationSignal.aborted) {
        throw abortError(cancellationSignal);
      }
      if (!accumulated.trim()) {
        throw new AriaError(
          'MODEL_UNAVAILABLE',
          503,
          'Le modèle ARIA est temporairement indisponible.',
          { reasonCode: 'MODEL_EMPTY_RESPONSE' },
        );
      }
      emitModel(modelFallback?.reasonCode);
      if (cancellationSignal.aborted) {
        throw abortError(cancellationSignal);
      }

      finalizationAttempted = true;
      await finalize({
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
          ragLatencyMs,
          timeToFirstTokenMs,
          generationDurationMs,
          modelFallback,
        }),
      });
      emit('COMPLETED', elapsed(applicationStartedAt), {
        ragStatus,
        finalState: 'COMPLETED',
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
      const reasonCode = executionReasonCode(error, failureCode);
      const terminalStatus = cancelled ? 'CANCELLED' : 'ERROR';
      emitModel(failureCode);
      const citations = accumulated && hits.length > 0 ? hits : [];
      finalizationAttempted = true;
      await finalize({
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
            reasonCode,
            downgradeReason,
            ragLatencyMs,
            timeToFirstTokenMs,
            generationDurationMs,
            modelFallback,
          }) : { reasonCode: 'PRE_POLICY_FAILURE' }),
        },
      });
      emit(
        cancelled ? 'CANCELLED' : failureCode === 'MODEL_TIMEOUT' ? 'TIMEOUT' : 'ERROR',
        elapsed(applicationStartedAt),
        { ragStatus, finalState: terminalStatus, reasonCode },
      );
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
