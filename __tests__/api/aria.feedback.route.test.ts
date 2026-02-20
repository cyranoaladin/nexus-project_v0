jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({
    logSecurityEvent: jest.fn(),
    logRequest: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/aria', () => ({
  recordAriaFeedback: jest.fn(),
}));

jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    ariaMessage: {
      findFirst: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
    },
  },
}));

import { POST } from '@/app/api/aria/feedback/route';
import { prisma } from '@/lib/prisma';

describe('aria feedback route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/aria/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'msg-1', feedback: true }),
    }) as any;

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when message not found', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({
      user: { role: 'ELEVE', id: 'user-1' },
    });
    (prisma.ariaMessage.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/aria/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'msg-1', feedback: true }),
    }) as any;

    const res = await POST(req);
    const json = await (res as any).json();
    expect(res.status).toBe(404);
    expect(json.error).toBe('Message non trouvé');
  });
});
