import {
  listAriaConversationMessages,
  listAriaConversations,
} from '@/lib/aria/application/history/public';
import { prismaAriaHistoryRepository } from '@/lib/aria/infrastructure/prisma/history-repository';

jest.mock('@/lib/aria/infrastructure/prisma/history-repository', () => ({
  prismaAriaHistoryRepository: {
    listConversations: jest.fn(),
    listMessages: jest.fn(),
  },
}));

describe('ARIA canonical history application boundary', () => {
  const actor = { userId: 'student-user-1', role: 'ELEVE' } as const;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['missing', undefined],
    ['unknown', 'unknown-course'],
  ])('rejects an active history with a %s course', async (_case, courseKey) => {
    await expect(listAriaConversations({
      actor,
      courseKey,
      contextState: 'ACTIVE',
      limit: 20,
    })).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
    expect(prismaAriaHistoryRepository.listConversations).not.toHaveBeenCalled();
  });

  it('rejects a course filter on unresolved legacy history', async () => {
    await expect(listAriaConversations({
      actor,
      courseKey: 'eds-nsi-terminale',
      contextState: 'LEGACY_CONTEXT_UNRESOLVED',
      limit: 20,
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaAriaHistoryRepository.listConversations).not.toHaveBeenCalled();
  });

  it.each([
    ['ACTIVE', 'eds-nsi-terminale'],
    ['LEGACY_CONTEXT_UNRESOLVED', undefined],
  ] as const)('delegates %s history with the exact actor and cursor', async (contextState, courseKey) => {
    (prismaAriaHistoryRepository.listConversations as jest.Mock).mockResolvedValue({
      conversations: [], nextCursor: null,
    });
    await listAriaConversations({
      actor,
      courseKey,
      contextState,
      cursor: 'opaque-cursor',
      limit: 7,
    });
    expect(prismaAriaHistoryRepository.listConversations).toHaveBeenCalledWith({
      actorUserId: 'student-user-1',
      courseKey,
      contextState,
      cursor: 'opaque-cursor',
      limit: 7,
    });
  });

  it('rejects a blank conversation identity before repository access', async () => {
    await expect(listAriaConversationMessages({
      actor,
      conversationId: '',
      limit: 20,
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaAriaHistoryRepository.listMessages).not.toHaveBeenCalled();
  });

  it('delegates message history with the exact actor, conversation and cursor', async () => {
    (prismaAriaHistoryRepository.listMessages as jest.Mock).mockResolvedValue({
      messages: [], nextCursor: null, activeTurn: null,
    });
    await listAriaConversationMessages({
      actor,
      conversationId: 'conversation-1',
      cursor: 'opaque-message-cursor',
      limit: 9,
    });
    expect(prismaAriaHistoryRepository.listMessages).toHaveBeenCalledWith({
      actorUserId: 'student-user-1',
      conversationId: 'conversation-1',
      cursor: 'opaque-message-cursor',
      limit: 9,
    });
  });
});
