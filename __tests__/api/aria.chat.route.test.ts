import { POST } from '@/app/api/aria/chat/route';
import { prisma } from '@/lib/prisma';
import { generateAriaResponse, saveAriaConversation } from '@/lib/aria';
import { checkAndAwardBadges } from '@/lib/badges';
import { createLogger } from '@/lib/middleware/logger';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaMessage: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/aria', () => ({
  generateAriaResponse: jest.fn(),
  saveAriaConversation: jest.fn(),
}));

jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn(),
}));

jest.mock('@/lib/middleware/logger', () => ({
  createLogger: jest.fn(),
}));

jest.mock('@/lib/aria-streaming', () => ({
  streamAriaResponse: jest.fn(),
}));

jest.mock('@/lib/entitlement', () => ({
  getUserEntitlements: jest.fn().mockResolvedValue([
    { id: 'ent-1', productCode: 'ARIA_MATHS', label: 'ARIA Maths', status: 'ACTIVE', startsAt: new Date(), endsAt: null, features: ['aria_maths', 'aria_nsi'] },
  ]),
}));

const loggerMock = {
  logSecurityEvent: jest.fn(),
  logRequest: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
};

function makeRequest(body?: any, accept?: string) {
  return {
    headers: new Headers({ accept: accept || 'application/json' }),
    json: async () => body,
  } as any;
}

describe('POST /api/aria/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createLogger as jest.Mock).mockReturnValue(loggerMock);
  });

  it('returns 401 when not authenticated as student', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: 'Salut' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Accès');
  });

  it('returns 404 when student profile missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-1', role: 'ELEVE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: 'Salut' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Profil');
  });

  it('returns 403 when subject not included in subscription', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-1', role: 'ELEVE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-1',
      subscriptions: [
        {
          ariaSubjects: ['FRANCAIS'],
        },
      ],
    });

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: 'Salut' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('ARIA');
  });

  it('returns 200 with conversation and message on success', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-1', role: 'ELEVE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-1',
      subscriptions: [
        {
          ariaSubjects: ['MATHEMATIQUES'],
        },
      ],
    });
    (prisma.ariaMessage.findMany as jest.Mock).mockResolvedValue([]);

    (generateAriaResponse as jest.Mock).mockResolvedValue('Voici la reponse');
    (saveAriaConversation as jest.Mock).mockResolvedValue({
      conversation: { id: 'conv-1', subject: 'MATHEMATIQUES', title: 'Conversation' },
      ariaMessage: { id: 'msg-1', createdAt: new Date('2025-01-01') },
    });
    (checkAndAwardBadges as jest.Mock).mockResolvedValue([
      { badge: { name: 'First', description: 'First', icon: 'star' } },
    ]);

    const response = await POST(makeRequest({ subject: 'MATHEMATIQUES', content: 'Salut' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.conversation.id).toBe('conv-1');
    expect(body.message.id).toBe('msg-1');
    expect(body.newBadges).toHaveLength(1);
  });
});
