jest.mock('@/lib/aria/application/conversation/run-conversation', () => ({
  makeRunAriaConversation: jest.fn((dependencies) => dependencies),
}));

jest.mock('@/lib/aria/application/conversation/build-prompt', () => ({
  buildAriaPromptEnvelope: jest.fn(() => [{ role: 'system', content: 'prompt' }]),
}));

jest.mock('@/lib/aria/infrastructure/prisma/conversation-repository', () => ({
  prismaAriaConversationRepository: { kind: 'repository' },
}));

jest.mock('@/lib/aria/rag', () => ({
  executeAriaRetrieval: jest.fn(),
  resolveAriaRetrievalPlan: jest.fn(),
}));

jest.mock('@/lib/aria/infrastructure/rag/disposable-academic-identity', () => ({
  resolveDisposableAriaRagIdentity: jest.fn(),
}));

jest.mock('@/lib/aria/gateway', () => ({ streamChatCompletion: jest.fn() }));
jest.mock('@/lib/aria/infrastructure/observability/telemetry', () => ({
  ariaConversationTelemetrySink: { emit: jest.fn() },
}));

import { executeAriaConversation } from '@/lib/aria/application/conversation/execute';
import { makeRunAriaConversation } from '@/lib/aria/application/conversation/run-conversation';
import { buildAriaPromptEnvelope } from '@/lib/aria/application/conversation/build-prompt';

describe('canonical conversation production wiring', () => {
  it('binds prompt, time and execution-token callbacks through one application engine', () => {
    const dependencies = executeAriaConversation as unknown as {
      buildPrompt(input: Record<string, unknown>): readonly unknown[];
      now(): Date;
      createExecutionToken(): string;
      monotonicNow(): number;
      modelPolicy: string;
    };
    const input = {
      context: {
        courseKey: 'eds-maths-terminale',
        skillId: 'skill-1',
        resourceId: 'resource-1',
      },
      mode: 'DISCOVERY',
      agentRole: 'TUTOR',
      citations: [],
      history: [],
      policy: { kind: 'GROUNDED_REQUIRED' },
      ragStatus: 'SUCCESS',
      message: 'Question',
    };

    expect(dependencies.buildPrompt(input)).toEqual([{ role: 'system', content: 'prompt' }]);
    expect(buildAriaPromptEnvelope as jest.Mock).toHaveBeenCalledWith({
      courseKey: 'eds-maths-terminale',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      skillId: 'skill-1',
      resourceId: 'resource-1',
      citations: [],
      conversationHistory: [],
      retrievalPolicy: 'GROUNDED_REQUIRED',
      ragStatus: 'SUCCESS',
      userMessage: 'Question',
    });
    expect(dependencies.now()).toBeInstanceOf(Date);
    expect(dependencies.createExecutionToken()).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isFinite(dependencies.monotonicNow())).toBe(true);
    expect(dependencies.modelPolicy).toBe('ARIA_CHAT_DEFAULT_V1');
    expect(makeRunAriaConversation as jest.Mock).toHaveBeenCalledTimes(1);
  });
});
