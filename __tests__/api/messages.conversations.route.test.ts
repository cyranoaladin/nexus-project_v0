import { GET } from '@/app/api/messages/conversations/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    message: { findMany: jest.fn() },
  },
}));

function makeRequest() {
  return {} as any;
}

describe('GET /api/messages/conversations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Authentification');
  });

  it('returns grouped conversations', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });
    (prisma.message.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'm1',
        senderId: 'user-1',
        receiverId: 'user-2',
        readAt: null,
        sender: { id: 'user-1', firstName: 'A', lastName: 'B', role: 'ELEVE' },
        receiver: { id: 'user-2', firstName: 'C', lastName: 'D', role: 'COACH' },
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.conversations).toHaveLength(1);
  });

  it('tracks unread counts and last message', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });
    const newer = new Date('2024-01-02T10:00:00.000Z');
    const older = new Date('2024-01-01T10:00:00.000Z');

    (prisma.message.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'm2',
        senderId: 'user-2',
        receiverId: 'user-1',
        readAt: null,
        createdAt: newer,
        sender: { id: 'user-2', firstName: 'C', lastName: 'D', role: 'COACH' },
        receiver: { id: 'user-1', firstName: 'A', lastName: 'B', role: 'ELEVE' },
      },
      {
        id: 'm1',
        senderId: 'user-1',
        receiverId: 'user-2',
        readAt: older,
        createdAt: older,
        sender: { id: 'user-1', firstName: 'A', lastName: 'B', role: 'ELEVE' },
        receiver: { id: 'user-2', firstName: 'C', lastName: 'D', role: 'COACH' },
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].lastMessage.id).toBe('m2');
    expect(body.conversations[0].unreadCount).toBe(1);
  });
});
