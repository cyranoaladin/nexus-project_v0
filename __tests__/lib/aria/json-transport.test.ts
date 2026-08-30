import { executeAriaConversation } from '@/lib/aria/application/conversation/public';
import { executeAriaConversationJson } from '@/lib/aria/transport/json';

jest.mock('@/lib/aria/application/conversation/public', () => ({ executeAriaConversation: jest.fn() }));

describe('ARIA JSON transport', () => {
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

    await expect(executeAriaConversationJson({
      context: { courseKey: 'eds-maths-premiere' } as never,
      clientRequestId: '00000000-0000-4000-8000-000000000012',
      message: 'Question',
    })).rejects.toMatchObject({ code: 'MODEL_TIMEOUT' });
  });
});
