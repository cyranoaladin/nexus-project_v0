import { AriaError } from '@/lib/aria/errors';
import {
  makeRunAriaConversation,
  type AriaConversationExecutionDependencies,
} from '@/lib/aria/application/conversation/run-conversation';
import type { AriaConversationRepository } from '@/lib/aria/application/conversation/ports';
import type { AriaConversationContext } from '@/lib/aria/application/conversation/public';

const context = {
  actor: { userId: 'user-1', role: 'STUDENT' },
  subject: { studentId: 'student-1' },
  student: { id: 'student-1' },
  courseKey: 'eds-maths-premiere',
  conversation: null,
  capabilities: { hasChat: true, hasRagCorpus: true, generalChatAllowed: false },
} as unknown as AriaConversationContext;

const hit = {
  id: 'hit-1',
  resourceId: 'resource-1',
  resourceVersionId: 'resource-version-1',
  contentSha256: 'a'.repeat(64),
  chunkId: 'chunk-1',
  locator: { page: 2 },
  corpusId: 'maths-premiere',
  corpusVersionId: 'corpus-version-1',
  manifestSha256: 'b'.repeat(64),
  sourceTitle: 'Programme officiel',
  sourceDocument: 'programme.pdf',
  sourceLocation: 'Page 2',
  courseKey: 'eds-maths-premiere',
  provenance: 'OFFICIEL_MEN',
  snippet: 'Définition canonique',
  score: 0.95,
} as const;
const retrievalAudit = {
  schemaVersion: 1 as const,
  manifestSha256: hit.manifestSha256,
  corpusId: hit.corpusId,
  corpusVersionId: hit.corpusVersionId,
  hits: [{
    resourceId: hit.resourceId,
    resourceVersionId: hit.resourceVersionId,
    contentSha256: hit.contentSha256,
    chunkId: hit.chunkId,
    locator: hit.locator,
  }],
};

function makeDependencies(overrides: Partial<AriaConversationExecutionDependencies> = {}) {
  const order: string[] = [];
  const repository: jest.Mocked<AriaConversationRepository> = {
    reserveTurn: jest.fn(async (_input: Parameters<AriaConversationRepository['reserveTurn']>[0]) => {
      void _input;
      order.push('reserve');
      return {
        turnId: 'turn-1', conversationId: 'conversation-1', userMessageId: 'user-message-1',
        assistantMessageId: 'assistant-message-1', status: 'PENDING' as const, disposition: 'RESERVED' as const,
      };
    }),
    claimTurn: jest.fn(async (_input: Parameters<AriaConversationRepository['claimTurn']>[0]) => {
      void _input;
      order.push('claim');
      return {
        turnId: 'turn-1', conversationId: 'conversation-1', status: 'RUNNING' as const,
        executionToken: 'execution-1', leaseExpiresAt: new Date(), disposition: 'CLAIMED' as const,
      };
    }),
    loadRecentCompletedTurns: jest.fn(async (
      _input: Parameters<AriaConversationRepository['loadRecentCompletedTurns']>[0],
    ) => {
      void _input;
      order.push('history');
      return [];
    }),
    checkpointRetrieval: jest.fn(async (
      _input: Parameters<AriaConversationRepository['checkpointRetrieval']>[0],
    ) => {
      void _input;
      order.push('checkpoint');
    }),
    finalizeTurn: jest.fn(async (_input: Parameters<AriaConversationRepository['finalizeTurn']>[0]) => {
      void _input;
      order.push('finalize');
    }),
    loadTurnResult: jest.fn<
      ReturnType<AriaConversationRepository['loadTurnResult']>,
      Parameters<AriaConversationRepository['loadTurnResult']>
    >(),
    requestCancellation: jest.fn<
      ReturnType<AriaConversationRepository['requestCancellation']>,
      Parameters<AriaConversationRepository['requestCancellation']>
    >(),
    heartbeatTurn: jest.fn(async (
      _input: Parameters<AriaConversationRepository['heartbeatTurn']>[0],
    ) => {
      void _input;
      return { disposition: 'RENEWED' as const };
    }),
  };
  const dependencies: AriaConversationExecutionDependencies = {
    repository,
    retrieve: jest.fn(async () => {
      order.push('retrieve');
      return { status: 'SUCCESS' as const, hits: [hit] };
    }),
    buildPrompt: jest.fn(() => {
      order.push('prompt');
      return [{ role: 'user' as const, content: 'Question' }];
    }),
    streamModel: jest.fn(async function* () {
      order.push('model');
      yield 'Réponse ';
      yield 'groundée.';
    }),
    now: jest.fn(() => new Date('2026-08-30T12:00:00.000Z')),
    createExecutionToken: jest.fn(() => 'execution-1'),
    monotonicNow: jest.fn(() => 0),
    modelPolicy: 'ARIA_CHAT_DEFAULT_V1',
    telemetry: { record: jest.fn() },
    ...overrides,
  };
  return { dependencies, repository, order };
}

describe('ARIA canonical conversation use case', () => {
  it('U016 ARIA-B-R007 executes reserve → claim → history → retrieval → checkpoint → prompt → model → TX2 once', async () => {
    const { dependencies, repository, order } = makeDependencies();
    const runConversation = makeRunAriaConversation(dependencies);

    const result = await runConversation({
      requestId: 'req-test-1',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000001',
      message: 'Explique la définition.',
      pedagogicalMode: 'GUIDED_PRACTICE',
    });

    expect(result).toMatchObject({
      turnId: 'turn-1',
      conversationId: 'conversation-1',
      messageId: 'assistant-message-1',
      status: 'COMPLETED',
      fullText: 'Réponse groundée.',
      ragStatus: 'SUCCESS',
    });
    expect(order).toEqual([
      'reserve', 'claim', 'history', 'retrieve', 'checkpoint', 'prompt', 'model', 'finalize',
    ]);
    expect(repository.reserveTurn).toHaveBeenCalledWith(expect.objectContaining({
      modelPolicy: { policyId: 'ARIA_CHAT_DEFAULT_V1' },
    }));
    expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    expect(repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({
      status: 'COMPLETED',
      content: 'Réponse groundée.',
      citations: [hit],
      retrievalEvidence: retrievalAudit,
      executionMetadata: expect.objectContaining({
        ragLatencyMs: 0,
        timeToFirstTokenMs: 0,
        generationDurationMs: 0,
      }),
    }));
    const telemetryEvents = (dependencies.telemetry.record as jest.Mock).mock.calls
      .map(([event]) => event.event);
    expect(telemetryEvents).toEqual(['START', 'RETRIEVAL', 'MODEL', 'FINALIZE', 'COMPLETED']);
    expect(JSON.stringify((dependencies.telemetry.record as jest.Mock).mock.calls))
      .not.toContain('Explique la définition.');
  });

  it('does not invoke retrieval, prompt or model for an existing in-progress idempotent Turn', async () => {
    const { dependencies, repository } = makeDependencies();
    (repository.reserveTurn as jest.Mock).mockResolvedValueOnce({
      turnId: 'turn-1', conversationId: 'conversation-1', userMessageId: 'user-message-1',
      assistantMessageId: 'assistant-message-1', status: 'RUNNING', disposition: 'IN_PROGRESS',
    });
    const result = await makeRunAriaConversation(dependencies)({
      requestId: 'req-test-2',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000001',
      message: 'Même requête.',
    });

    expect(result).toMatchObject({ status: 'RUNNING', disposition: 'IN_PROGRESS' });
    expect(dependencies.retrieve).not.toHaveBeenCalled();
    expect(dependencies.streamModel).not.toHaveBeenCalled();
    expect(repository.claimTurn).not.toHaveBeenCalled();
  });

  it('preserves a persisted PENDING Turn instead of reporting a false RUNNING lifecycle state', async () => {
    const { dependencies, repository } = makeDependencies();
    (repository.reserveTurn as jest.Mock).mockResolvedValueOnce({
      turnId: 'turn-pending', conversationId: 'conversation-1', userMessageId: 'user-message-1',
      assistantMessageId: 'assistant-message-1', status: 'PENDING', disposition: 'IN_PROGRESS',
    });
    const onStart = jest.fn();
    const result = await makeRunAriaConversation(dependencies)({
      requestId: 'req-test-3',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000011',
      message: 'Même requête réservée.',
      onStart,
    });
    expect(result).toMatchObject({ status: 'PENDING', disposition: 'IN_PROGRESS' });
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
  });

  it('U017 replays a terminal idempotent Turn without invoking retrieval or model', async () => {
    const { dependencies, repository } = makeDependencies();
    (repository.reserveTurn as jest.Mock).mockResolvedValueOnce({
      turnId: 'turn-1', conversationId: 'conversation-1', userMessageId: 'user-message-1',
      assistantMessageId: 'assistant-message-1', status: 'COMPLETED', disposition: 'REPLAY',
    });
    repository.loadTurnResult.mockResolvedValueOnce({
      turnId: 'turn-1', conversationId: 'conversation-1', assistantMessageId: 'assistant-message-1',
      status: 'COMPLETED', content: 'Réponse persistée', ragStatus: 'SUCCESS', citations: [hit],
    });

    const result = await makeRunAriaConversation(dependencies)({
      requestId: 'req-test-4',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000006',
      message: 'Même requête terminale.',
    });
    expect(result).toMatchObject({ disposition: 'REPLAY', fullText: 'Réponse persistée' });
    expect(dependencies.retrieve).not.toHaveBeenCalled();
    expect(dependencies.streamModel).not.toHaveBeenCalled();
  });

  it('U024 does not execute external work when another worker won the claim', async () => {
    const { dependencies, repository } = makeDependencies();
    repository.claimTurn.mockResolvedValueOnce({
      turnId: 'turn-1', conversationId: 'conversation-1', status: 'PENDING',
      executionToken: 'other-token', disposition: 'NOT_CLAIMED',
    });
    const result = await makeRunAriaConversation(dependencies)({
      requestId: 'req-test-5',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000007',
      message: 'Claim concurrent.',
    });
    expect(result).toMatchObject({ disposition: 'IN_PROGRESS', status: 'PENDING' });
    expect(dependencies.retrieve).not.toHaveBeenCalled();
    expect(dependencies.streamModel).not.toHaveBeenCalled();
  });

  it('never invokes retrieval or model when policy resolves NO_MODEL', async () => {
    const noModelContext = {
      ...context,
      capabilities: { hasChat: false, hasRagCorpus: false, generalChatAllowed: false },
    } as AriaConversationContext;
    const { dependencies, repository } = makeDependencies();
    await expect(makeRunAriaConversation(dependencies)({
      requestId: 'req-test-6',
      context: noModelContext,
      clientRequestId: '00000000-0000-4000-8000-000000000008',
      message: 'Cours sans chat.',
    })).resolves.toMatchObject({ status: 'ERROR', failureCode: 'UNSUPPORTED' });
    expect(dependencies.retrieve).not.toHaveBeenCalled();
    expect(dependencies.streamModel).not.toHaveBeenCalled();
    expect(repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({ status: 'ERROR' }));
  });

  it('allows an observable ungrounded downgrade only for OPTIONAL_GROUNDING', async () => {
    const { dependencies, repository } = makeDependencies({
      retrieve: jest.fn(async () => ({
        status: 'RUNTIME_UNAVAILABLE' as const,
        hits: [],
        attempted: {
          manifestSha256: hit.manifestSha256,
          corpusId: hit.corpusId,
          corpusVersionId: hit.corpusVersionId,
        },
      })),
    });
    const result = await makeRunAriaConversation(dependencies)({
      requestId: 'req-test-7',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000009',
      message: 'Méthode générale.',
      pedagogicalMode: 'METHODOLOGY',
    });
    expect(result).toMatchObject({ status: 'COMPLETED', ragStatus: 'RUNTIME_UNAVAILABLE' });
    expect(dependencies.streamModel).toHaveBeenCalledTimes(1);
    expect(repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({
      executionMetadata: expect.objectContaining({
        downgradeReason: 'RUNTIME_UNAVAILABLE_POLICY_AUTHORIZED',
      }),
    }));
  });

  it('checkpoints RUNTIME_UNAVAILABLE then fails required grounding without invoking the model', async () => {
    const { dependencies, repository } = makeDependencies({
      retrieve: jest.fn(async () => ({
        status: 'RUNTIME_UNAVAILABLE' as const,
        hits: [],
        attempted: {
          manifestSha256: hit.manifestSha256,
          corpusId: hit.corpusId,
          corpusVersionId: hit.corpusVersionId,
        },
      })),
    });

    await expect(makeRunAriaConversation(dependencies)({
      requestId: 'req-test-8',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000002',
      message: 'Question requérant les sources.',
      pedagogicalMode: 'GUIDED_PRACTICE',
    })).resolves.toMatchObject({
      status: 'ERROR', failureCode: 'RAG_UNAVAILABLE', ragStatus: 'RUNTIME_UNAVAILABLE',
    });

    expect(repository.checkpointRetrieval).toHaveBeenCalledWith(expect.objectContaining({
      ragStatus: 'RUNTIME_UNAVAILABLE',
      retrievalEvidence: { ...retrievalAudit, hits: [] },
    }));
    expect(dependencies.streamModel).not.toHaveBeenCalled();
    expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    expect(repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({ status: 'ERROR' }));
  });

  it.each([
    ['USER_CANCELLED', 'CANCELLED'],
    ['MODEL_TIMEOUT', 'ERROR'],
  ] as const)('persists %s using the canonical Turn terminal state %s with retrieval evidence', async (code, status) => {
    const { dependencies, repository } = makeDependencies({
      streamModel: jest.fn(async function* () {
        yield 'Sortie partielle';
        throw new AriaError(code, code === 'USER_CANCELLED' ? 499 : 504, 'failure');
      }),
    });

    const execution = makeRunAriaConversation(dependencies)({
      requestId: 'req-test-9',
      context,
      clientRequestId: `00000000-0000-4000-8000-00000000000${status === 'ERROR' ? '4' : '3'}`,
      message: 'Question interrompue.',
      pedagogicalMode: 'GUIDED_PRACTICE',
    });
    if (code === 'USER_CANCELLED') {
      await expect(execution).resolves.toMatchObject({
        status: 'CANCELLED',
        fullText: 'Sortie partielle',
        citations: [hit],
      });
    } else {
      await expect(execution).resolves.toMatchObject({
        status: 'ERROR', failureCode: code, ragStatus: 'SUCCESS',
      });
    }

    expect(repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({
      status,
      content: 'Sortie partielle',
      retrievalEvidence: retrievalAudit,
      executionMetadata: expect.objectContaining({ failureCode: code }),
    }));
    expect((dependencies.telemetry.record as jest.Mock).mock.calls.map(([event]) => event.event))
      .toContain(code === 'USER_CANCELLED' ? 'CANCELLED' : 'TIMEOUT');
  });

  it('U022 ARIA-B-R071 never attempts a second terminalization when TX2 itself fails', async () => {
    const finalizationFailure = new Error('TX2_FAILURE');
    const { dependencies, repository } = makeDependencies();
    repository.finalizeTurn.mockRejectedValueOnce(finalizationFailure);

    await expect(makeRunAriaConversation(dependencies)({
      requestId: 'req-test-10',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000005',
      message: 'Question.',
      pedagogicalMode: 'GUIDED_PRACTICE',
    })).rejects.toBe(finalizationFailure);
    expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    expect(dependencies.telemetry.record).toHaveBeenCalledWith(expect.objectContaining({
      event: 'ERROR', reasonCode: 'FINALIZATION_FAILED', finalState: 'ERROR',
    }));
  });

  it('notifies completion only after TX2 commits', async () => {
    const { dependencies, repository } = makeDependencies();
    let releaseFinalization: (() => void) | undefined;
    repository.finalizeTurn.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseFinalization = resolve;
    }));
    const onComplete = jest.fn();
    const execution = makeRunAriaConversation(dependencies)({
      requestId: 'req-test-11',
      context,
      clientRequestId: '00000000-0000-4000-8000-000000000010',
      message: 'Ordre du commit.',
      pedagogicalMode: 'GUIDED_PRACTICE',
      onComplete,
    });
    await new Promise<void>((resolve) => {
      const inspect = () => {
        if (repository.finalizeTurn.mock.calls.length > 0) resolve();
        else setImmediate(inspect);
      };
      inspect();
    });
    expect(onComplete).not.toHaveBeenCalled();
    releaseFinalization?.();
    await execution;
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
