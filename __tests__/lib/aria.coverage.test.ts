/**
 * @jest-environment node
 */

/**
 * Tests for lib/aria.ts — Coverage boost
 *
 * Covers: recordAriaFeedback, saveAriaConversation
 */

// Mock OpenAI before importing
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked ARIA response' } }],
        }),
      },
    },
  }));
});

import { recordAriaFeedback, saveAriaConversation } from '@/lib/aria';

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    ariaConversation: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    ariaMessage: {
      create: jest.Mock;
      update: jest.Mock;
    };
    pedagogicalContent: {
      findMany: jest.Mock;
    };
  };
};

describe('recordAriaFeedback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates message with positive feedback', async () => {
    prisma.ariaMessage.update.mockResolvedValue({ id: 'msg-1', feedback: true });

    const result = await recordAriaFeedback('msg-1', true);

    expect(result.feedback).toBe(true);
    expect(prisma.ariaMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { feedback: true },
    });
  });

  it('updates message with negative feedback', async () => {
    prisma.ariaMessage.update.mockResolvedValue({ id: 'msg-2', feedback: false });

    const result = await recordAriaFeedback('msg-2', false);

    expect(result.feedback).toBe(false);
  });
});

describe('saveAriaConversation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates new conversation when no conversationId provided', async () => {
    prisma.ariaConversation.create.mockResolvedValue({ id: 'conv-new', studentId: 's1', subject: 'MATHEMATIQUES' });
    prisma.ariaMessage.create
      .mockResolvedValueOnce({ id: 'msg-user', role: 'user' })
      .mockResolvedValueOnce({ id: 'msg-aria', role: 'assistant' });

    const result = await saveAriaConversation('s1', 'MATHEMATIQUES' as any, 'Bonjour', 'Salut!');

    expect(prisma.ariaConversation.create).toHaveBeenCalledTimes(1);
    expect(prisma.ariaMessage.create).toHaveBeenCalledTimes(2);
    expect(result.conversation.id).toBe('conv-new');
    expect(result.ariaMessage.id).toBe('msg-aria');
  });

  it('reuses existing conversation when conversationId provided and found', async () => {
    prisma.ariaConversation.findUnique.mockResolvedValue({ id: 'conv-existing' });
    prisma.ariaMessage.create
      .mockResolvedValueOnce({ id: 'msg-user' })
      .mockResolvedValueOnce({ id: 'msg-aria' });

    const result = await saveAriaConversation('s1', 'MATHEMATIQUES' as any, 'Question', 'Réponse', 'conv-existing');

    expect(prisma.ariaConversation.findUnique).toHaveBeenCalledWith({ where: { id: 'conv-existing' } });
    expect(prisma.ariaConversation.create).not.toHaveBeenCalled();
    expect(result.conversation.id).toBe('conv-existing');
  });

  it('creates new conversation when conversationId not found', async () => {
    prisma.ariaConversation.findUnique.mockResolvedValue(null);
    prisma.ariaConversation.create.mockResolvedValue({ id: 'conv-fallback' });
    prisma.ariaMessage.create
      .mockResolvedValueOnce({ id: 'msg-user' })
      .mockResolvedValueOnce({ id: 'msg-aria' });

    const result = await saveAriaConversation('s1', 'NSI' as any, 'Python help', 'Voici...', 'nonexistent');

    expect(prisma.ariaConversation.findUnique).toHaveBeenCalled();
    expect(prisma.ariaConversation.create).toHaveBeenCalledTimes(1);
    expect(result.conversation.id).toBe('conv-fallback');
  });
});
