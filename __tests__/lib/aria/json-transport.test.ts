import { executeAriaConversation } from '@/lib/aria/application/conversation/public';
import { executeAriaConversationJson } from '@/lib/aria/transport/json';

jest.mock('@/lib/aria/application/conversation/public', () => ({ executeAriaConversation: jest.fn() }));

describe('ARIA JSON transport', () => {
  const input = {
    requestId: 'req-json-test',
    context: { courseKey: 'eds-maths-premiere' } as never,
    clientRequestId: '00000000-0000-4000-8000-000000000012',
    message: 'Question',
  };

  it('maps a persisted terminal ERROR back to a typed public-boundary application error', async () => {
    (executeAriaConversation as jest.Mock).mockResolvedValue({
      turnId: 'turn-error',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      status: 'ERROR',
      disposition: 'EXECUTED',
      fullText: 'Sortie partielle',
      ragStatus: 'SUCCESS',
      citations: [],
      failureCode: 'MODEL_TIMEOUT',
    });

    await expect(executeAriaConversationJson(input))
      .rejects.toMatchObject({ code: 'MODEL_TIMEOUT' });
  });

  it('fails with INTERNAL_ERROR when a corrupted terminal result omits its failure code', async () => {
    (executeAriaConversation as jest.Mock).mockResolvedValue({
      turnId: 'turn-error', conversationId: 'conversation-1', messageId: 'message-1',
      status: 'ERROR', disposition: 'EXECUTED', fullText: '', citations: [],
    });

    await expect(executeAriaConversationJson(input))
      .rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('collects the canonical execution result without inventing RAG metadata', async () => {
    (executeAriaConversation as jest.Mock).mockResolvedValue({
      turnId: 'turn-complete', conversationId: 'conversation-1', messageId: 'message-1',
      status: 'COMPLETED', disposition: 'EXECUTED', fullText: 'Réponse', citations: [],
    });

    await expect(executeAriaConversationJson(input)).resolves.toEqual({
      success: true,
      conversation: { id: 'conversation-1', courseKey: 'eds-maths-premiere' },
      turn: { id: 'turn-complete', status: 'COMPLETED', disposition: 'EXECUTED' },
      message: { id: 'message-1', content: 'Réponse', citations: [] },
      metadata: {
        turnId: 'turn-complete', courseKey: 'eds-maths-premiere',
        status: 'COMPLETED', disposition: 'EXECUTED',
      },
    });
  });
});
