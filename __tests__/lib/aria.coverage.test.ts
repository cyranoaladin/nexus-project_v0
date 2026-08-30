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

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findUnique: jest.fn().mockResolvedValue({
        id: 's1',
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        academicEnrollments: [
          { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' },
          { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY' },
        ],
        subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES', 'NSI'] }],
      }),
    },
    ariaConversation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    ariaMessage: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({ id: 'msg-1', conversation: { studentId: 's1' } }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ariaFeedback: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'fb-1' }),
      update: jest.fn().mockResolvedValue({ id: 'fb-1' }),
    },
    pedagogicalContent: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

import { recordAriaFeedback, saveAriaConversation } from '@/lib/aria';
import { prisma } from '@/lib/prisma';

describe('recordAriaFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.ariaMessage.findUnique as jest.Mock).mockResolvedValue({
      id: 'msg-1',
      conversation: { studentId: 's1' },
    });
    (prisma.ariaFeedback.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.ariaFeedback.create as jest.Mock).mockResolvedValue({ id: 'fb-1' });
    (prisma.ariaFeedback.update as jest.Mock).mockResolvedValue({ id: 'fb-1' });
  });

  it('updates message with positive feedback', async () => {
    (prisma.ariaMessage.update as jest.Mock).mockResolvedValue({ id: 'msg-1', feedback: true });

    const result = await recordAriaFeedback('msg-1', true);

    expect(result.feedback).toBe(true);
    expect(prisma.ariaMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { feedback: true },
    });
  });

  it('updates message with negative feedback', async () => {
    (prisma.ariaMessage.update as jest.Mock).mockResolvedValue({ id: 'msg-2', feedback: false });
    (prisma.ariaMessage.findUnique as jest.Mock).mockResolvedValue({
      id: 'msg-2',
      conversation: { studentId: 's1' },
    });

    const result = await recordAriaFeedback('msg-2', false);

    expect(result.feedback).toBe(false);
  });
});

describe('saveAriaConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      academicEnrollments: [
        { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' },
        { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY' },
      ],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES', 'NSI'] }],
    });
  });

  it('creates new conversation when no conversationId provided', async () => {
    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'conv-new', studentId: 's1', subject: 'MATHEMATIQUES' });
    (prisma.ariaMessage.create as jest.Mock)
      .mockResolvedValueOnce({ id: 'msg-user', role: 'user' })
      .mockResolvedValueOnce({ id: 'msg-aria', role: 'assistant' });

    const result = await saveAriaConversation('s1', 'MATHEMATIQUES' as any, 'Bonjour', 'Salut!');

    expect(prisma.ariaConversation.create).toHaveBeenCalledTimes(1);
    expect(prisma.ariaMessage.create).toHaveBeenCalledTimes(2);
    expect(result.conversation.id).toBe('conv-new');
    expect(result.ariaMessage.id).toBe('msg-aria');
  });

  it('reuses existing conversation when conversationId provided and found', async () => {
    (prisma.ariaConversation.findFirst as jest.Mock).mockResolvedValue({ id: 'conv-existing' });
    (prisma.ariaMessage.create as jest.Mock)
      .mockResolvedValueOnce({ id: 'msg-user', role: 'user' })
      .mockResolvedValueOnce({ id: 'msg-aria', role: 'assistant' });

    const result = await saveAriaConversation('s1', 'MATHEMATIQUES' as any, 'Question', 'Réponse', 'conv-existing');

    expect(prisma.ariaConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv-existing' },
    });
    expect(prisma.ariaConversation.create).not.toHaveBeenCalled();
    expect(result.conversation.id).toBe('conv-existing');
  });

  it('rejects an unknown or non-owned conversationId', async () => {
    (prisma.ariaConversation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      saveAriaConversation('s1', 'NSI' as any, 'Python help', 'Voici...', 'nonexistent')
    ).rejects.toThrow('ARIA_CONVERSATION_NOT_FOUND');

    expect(prisma.ariaConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'nonexistent' },
    });
    expect(prisma.ariaConversation.create).not.toHaveBeenCalled();
    expect(prisma.ariaMessage.create).not.toHaveBeenCalled();
  });
});
