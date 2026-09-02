import { auth } from '@/auth';
import { GET } from '@/app/api/aria/conversations/[conversationId]/messages/route';
import { listAriaConversationMessages } from '@/lib/aria/application/history/public';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/history/public', () => ({ listAriaConversationMessages: jest.fn() }));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

describe('GET /api/aria/conversations/:conversationId/messages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ARIA-B-R021 returns a complete chronological page with canonical feedback and citations', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-1' } });
    (listAriaConversationMessages as jest.Mock).mockResolvedValue({
      conversation: {
        id: 'conversation-1', courseKey: 'eds-maths-premiere', contextState: 'ACTIVE', resumable: true,
        activeTurn: {
          turnId: 'turn-running', clientRequestId: '00000000-0000-4000-8000-000000000001',
          status: 'RUNNING', pedagogicalMode: 'METHODOLOGY',
        },
      },
      messages: [{
        courseKey: 'eds-maths-premiere', conversationId: 'conversation-1',
        turnId: 'turn-1', messageId: 'message-1', role: 'assistant', content: 'Réponse',
        status: 'COMPLETED', citations: [{ resourceVersionId: 'version-1' }],
        feedback: true, createdAt: '2026-08-30T12:00:00.000Z',
      }],
      nextCursor: 'older-page',
    });
    const response = await GET(
      new Request('http://localhost/api/aria/conversations/conversation-1/messages?limit=25') as never,
      { params: Promise.resolve({ conversationId: 'conversation-1' }) },
    );
    await expect(response.json()).resolves.toMatchObject({
      conversation: {
        activeTurn: {
          turnId: 'turn-running', status: 'RUNNING', pedagogicalMode: 'METHODOLOGY',
        },
      },
      messages: [{ turnId: 'turn-1', status: 'COMPLETED', feedback: true }],
      nextCursor: 'older-page',
    });
    expect(listAriaConversationMessages).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
      conversationId: 'conversation-1', cursor: undefined, limit: 25,
    });
  });

  it('rejects unknown query fields before data access', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-2' } });
    const invalid = await GET(
      new Request('http://localhost/api/aria/conversations/conversation-1/messages?subject=NSI') as never,
      { params: Promise.resolve({ conversationId: 'conversation-1' }) },
    );
    expect(invalid.status).toBe(400);
    expect(listAriaConversationMessages).not.toHaveBeenCalled();
  });

  it('rejects duplicate query fields before data access', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-2' } });
    const invalid = await GET(
      new Request(
        'http://localhost/api/aria/conversations/conversation-1/messages?limit=10&limit=20',
      ) as never,
      { params: Promise.resolve({ conversationId: 'conversation-1' }) },
    );
    expect(invalid.status).toBe(400);
    expect(listAriaConversationMessages).not.toHaveBeenCalled();
  });

  it('redacts persisted citation corruption from the public history response', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-2' } });
    (listAriaConversationMessages as jest.Mock).mockRejectedValueOnce(new AriaError(
      'INTERNAL_ERROR',
      500,
      'Citation /srv/private leaked-account@example.test',
      { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    ));

    const response = await GET(
      new Request('http://localhost/api/aria/conversations/conversation-1/messages') as never,
      { params: Promise.resolve({ conversationId: 'conversation-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: { code: 'INTERNAL_ERROR', retryable: false },
    });
    expect(JSON.stringify(body)).not.toMatch(/srv|example\.test|PERSISTED_CITATION/);
  });
});
