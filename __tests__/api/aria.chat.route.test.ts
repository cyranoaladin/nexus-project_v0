import { auth } from '@/auth';
import { POST } from '@/app/api/aria/chat/route';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { executeAriaConversationJson } from '@/lib/aria/orchestration';
import { AriaError } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';
import type { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/aria/application/conversation/public', () => ({
  buildAriaConversationContext: jest.fn(),
}));

jest.mock('@/lib/aria/orchestration', () => ({
  streamAriaConversation: jest.fn(),
  executeAriaConversationJson: jest.fn(),
}));

jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn(),
}));

jest.mock('@/lib/middleware/logger', () => ({
  createLogger: jest.fn(),
}));

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    headers: new Headers({
      'content-type': 'application/json',
      ...headers,
    }),
    json: async () => body,
    signal: undefined,
  } as unknown as NextRequest;
}

describe('POST /api/aria/chat', () => {
  const clientRequestId = '00000000-0000-4000-8000-000000000001';
  const context = {
    courseKey: 'eds-maths-terminale',
    conversation: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createLogger as jest.Mock).mockReturnValue({
      logSecurityEvent: jest.fn(),
      logRequest: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Accès non autorisé');
  });

  it('returns 401 when role is not ELEVE', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Accès non autorisé');
  });

  it('returns 400 for invalid payload shape', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });

    const response = await POST(makeRequest({ courseKey: 'unknown-course' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données de requête invalides');
  });

  it('returns stable NOT_ENROLLED without exposing the internal message', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockRejectedValue(
      new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable.')
    );

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({ code: 'NOT_ENROLLED', retryable: false });
    expect(JSON.stringify(body)).not.toContain('Profil élève introuvable');
  });

  it('returns 400 when message is empty or whitespace', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: '   ' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données de requête invalides');
  });

  it('returns 200 with conversation and message on success via unified pipeline', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);

    (executeAriaConversationJson as jest.Mock).mockResolvedValue({
      conversationId: 'conv-1',
      messageId: 'msg-1',
      fullText: 'Voici la reponse',
      citations: [],
      newBadges: [{ name: 'First', description: 'First', icon: 'star' }],
    });

    const response = await POST(makeRequest({ courseKey: 'eds-maths-terminale', clientRequestId, content: 'Salut' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.conversation.id).toBe('conv-1');
    expect(body.message.id).toBe('msg-1');
    expect(body.newBadges).toHaveLength(1);
    expect(executeAriaConversationJson).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        message: 'Salut',
      })
    );
    expect(buildAriaConversationContext).toHaveBeenCalledWith({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      skillId: undefined,
      resourceId: undefined,
      conversationId: undefined,
    });
  });

  it('returns 404 when conversation is not found or belongs to another student', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-2-user', role: 'ELEVE' },
    });
    (buildAriaConversationContext as jest.Mock).mockRejectedValue(
      new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation introuvable.')
    );

    const response = await POST(makeRequest({
      conversationId: 'student-1-conversation',
      courseKey: 'eds-maths-terminale',
      clientRequestId,
      content: 'Continue la conversation',
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({ code: 'CONVERSATION_NOT_FOUND', retryable: false });
    expect(executeAriaConversationJson).not.toHaveBeenCalled();
  });

  it('requires a client-generated UUID idempotency key', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });

    for (const clientRequestIdValue of [undefined, 'server-default', '']) {
      const response = await POST(makeRequest({
        courseKey: 'eds-maths-terminale',
        content: 'Question',
        ...(clientRequestIdValue === undefined ? {} : { clientRequestId: clientRequestIdValue }),
      }));
      expect(response.status).toBe(400);
    }
    expect(buildAriaConversationContext).not.toHaveBeenCalled();
  });
});
