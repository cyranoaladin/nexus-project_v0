jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
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

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findUnique: jest.fn(),
    },
    ariaConversation: {
      findMany: jest.fn(),
    },
  },
}));

import { GET } from '@/app/api/aria/conversations/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

describe('aria conversations route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/aria/conversations') as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when student not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce({
      user: { role: 'ELEVE', id: 'user-1' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/aria/conversations') as any;
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns conversations list', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce({
      user: { role: 'ELEVE', id: 'user-1' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'student-1' });
    (prisma.ariaConversation.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'conv-1',
        subject: 'NSI',
        title: 'Titre',
        messages: [{ id: 'msg-1', role: 'user', content: 'Hi', feedback: null, createdAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const req = new Request('http://localhost/api/aria/conversations?subject=NSI') as any;
    const res = await GET(req);
    const json = await (res as any).json();
    expect(res.status).toBe(200);
    expect(json.conversations.length).toBe(1);
  });
});
