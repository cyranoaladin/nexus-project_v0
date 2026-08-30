import { auth } from '@/auth';
import { POST } from '@/app/api/aria/chat/route';
import { prisma } from '@/lib/prisma';
import { streamAriaConversation, executeAriaConversationJson } from '@/lib/aria/orchestration';
import { AriaError } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaConversation: { findFirst: jest.fn() },
    ariaMessage: { findMany: jest.fn() },
  },
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
  } as any;
}

describe('POST /api/aria/chat', () => {
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

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Accès non autorisé');
  });

  it('returns 401 when role is not ELEVE', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Accès non autorisé');
  });

  it('returns 400 for invalid payload shape', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });

    const response = await POST(makeRequest({ subject: 'INVALID_SUBJECT' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données de requête invalides');
  });

  it('returns 404 when student record is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: 'Bonjour' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Profil élève introuvable.');
  });

  it('returns 400 when message is empty or whitespace', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: '   ' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données de requête invalides');
  });

  it('returns 200 with conversation and message on success via unified pipeline', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-user-1', role: 'ELEVE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-1',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      subscriptions: [
        {
          ariaSubjects: JSON.stringify(['MATHEMATIQUES']),
        },
      ],
    });

    (executeAriaConversationJson as jest.Mock).mockResolvedValue({
      conversationId: 'conv-1',
      messageId: 'msg-1',
      fullText: 'Voici la reponse',
      citations: [],
      newBadges: [{ name: 'First', description: 'First', icon: 'star' }],
    });

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: 'Salut' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.conversation.id).toBe('conv-1');
    expect(body.message.id).toBe('msg-1');
    expect(body.newBadges).toHaveLength(1);
    expect(executeAriaConversationJson).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-1',
        courseKey: 'eds-maths-terminale',
        message: 'Salut',
      })
    );
  });

  it('returns 404 when conversation is not found or belongs to another student', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-2-user', role: 'ELEVE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-2',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      subscriptions: [
        {
          ariaSubjects: JSON.stringify(['MATHEMATIQUES']),
        },
      ],
    });

    (executeAriaConversationJson as jest.Mock).mockRejectedValue(
      new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation introuvable.')
    );

    const response = await POST(makeRequest({
      conversationId: 'student-1-conversation',
      subject: 'MATHEMATIQUES',
      content: 'Continue la conversation',
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Conversation');
    expect(executeAriaConversationJson).toHaveBeenCalled();
  });
});
