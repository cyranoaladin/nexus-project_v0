import {
  makeRunAriaConversation,
  type AriaConversationExecutionDependencies,
} from '@/lib/aria/application/conversation/run-conversation';
import type { AriaConversationRepository } from '@/lib/aria/application/conversation/ports';
import type { AriaConversationContext } from '@/lib/aria/application/conversation/public';

export const ARIA_INTEGRATION_HIT = {
  id: 'hit-integration-1',
  resourceId: 'resource-integration-1',
  resourceVersionId: 'resource-version-integration-1',
  contentSha256: 'a'.repeat(64),
  chunkId: 'chunk-integration-1',
  locator: { page: 2 },
  corpusId: 'maths-premiere',
  corpusVersionId: 'corpus-version-integration-1',
  manifestSha256: 'b'.repeat(64),
  sourceTitle: 'Programme officiel',
  sourceDocument: 'programme.pdf',
  sourceLocation: 'Page 2',
  courseKey: 'eds-maths-premiere',
  provenance: 'OFFICIEL_MEN',
  snippet: 'Définition canonique',
  score: 0.95,
} as const;

export function ariaIntegrationContext(
  overrides: Partial<AriaConversationContext> = {},
): AriaConversationContext {
  return {
    actor: { userId: 'user-integration-1', role: 'STUDENT' },
    subject: { studentId: 'student-integration-1' },
    student: { id: 'student-integration-1' },
    courseKey: 'eds-maths-premiere',
    conversation: null,
    capabilities: { hasChat: true, hasRagCorpus: true, generalChatAllowed: false },
    ...overrides,
  } as unknown as AriaConversationContext;
}

export function makeAriaApplicationFixture(input: Readonly<{
  dependencyOverrides?: Partial<AriaConversationExecutionDependencies>;
  repositoryOverrides?: Partial<jest.Mocked<AriaConversationRepository>>;
}> = {}) {
  const order: string[] = [];
  const repository: jest.Mocked<AriaConversationRepository> = {
    reserveTurn: jest.fn(async () => {
      order.push('reserve');
      return {
        turnId: 'turn-integration-1', conversationId: 'conversation-integration-1',
        userMessageId: 'user-message-integration-1',
        assistantMessageId: 'assistant-message-integration-1',
        status: 'PENDING' as const, disposition: 'RESERVED' as const,
      };
    }),
    claimTurn: jest.fn(async () => {
      order.push('claim');
      return {
        turnId: 'turn-integration-1', conversationId: 'conversation-integration-1',
        status: 'RUNNING' as const, executionToken: 'execution-integration-1',
        leaseExpiresAt: new Date('2026-08-30T12:01:00.000Z'), disposition: 'CLAIMED' as const,
      };
    }),
    loadRecentCompletedTurns: jest.fn(async () => {
      order.push('history');
      return [];
    }),
    checkpointRetrieval: jest.fn(async () => { order.push('checkpoint'); }),
    finalizeTurn: jest.fn(async () => { order.push('finalize'); }),
    loadTurnResult: jest.fn(),
    requestCancellation: jest.fn(),
    heartbeatTurn: jest.fn(async () => ({ disposition: 'RENEWED' as const })),
    ...input.repositoryOverrides,
  };
  const telemetry = { record: jest.fn() };
  const dependencies: AriaConversationExecutionDependencies = {
    repository,
    retrieve: jest.fn(async () => {
      order.push('retrieve');
      return { status: 'SUCCESS' as const, hits: [ARIA_INTEGRATION_HIT] };
    }),
    buildPrompt: jest.fn(() => {
      order.push('prompt');
      return [{ role: 'user' as const, content: 'Question' }];
    }),
    streamModel: jest.fn(async function* () {
      order.push('model');
      yield 'Réponse groundée.';
    }),
    now: jest.fn(() => new Date('2026-08-30T12:00:00.000Z')),
    createExecutionToken: jest.fn(() => 'execution-integration-1'),
    monotonicNow: jest.fn(() => 0),
    modelPolicy: 'ARIA_CHAT_DEFAULT_V1',
    telemetry,
    ...input.dependencyOverrides,
  };
  return {
    context: ariaIntegrationContext(),
    dependencies,
    order,
    repository,
    run: makeRunAriaConversation(dependencies),
    telemetry,
  };
}

export function ariaIntegrationInput(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'request-integration-1',
    context: ariaIntegrationContext(),
    clientRequestId: '00000000-0000-4000-8000-000000000100',
    message: 'Explique ce point du programme.',
    ...overrides,
  };
}
