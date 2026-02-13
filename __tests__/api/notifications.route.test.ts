import { GET, PATCH } from '@/app/api/notifications/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    notification: { findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  },
}));

function makeRequest(body?: any, url?: string) {
  return {
    json: async () => body,
    url: url || 'http://localhost:3000/api/notifications',
  } as any;
}

describe('notifications route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/notifications'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET returns notifications and unread count', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([{ id: 'n1' }]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(2);

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/notifications?unread=true&limit=5'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.notifications).toHaveLength(1);
    expect(body.unreadCount).toBe(2);
  });

  it('GET filters unread notifications and applies limit', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(0);

    await GET(makeRequest(undefined, 'http://localhost:3000/api/notifications?unread=true&limit=3'));

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ read: false, userId: 'user-1' }),
        take: 3,
      })
    );
  });

  it('PATCH marks notification as read', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });

    const response = await PATCH(makeRequest({ notificationId: 'n1', action: 'markAsRead' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('PATCH marks all notifications as read', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });

    const response = await PATCH(makeRequest({ notificationId: 'n1', action: 'markAllAsRead' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      })
    );
  });

  it('PATCH returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await PATCH(makeRequest({ notificationId: 'n1', action: 'markAsRead' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('PATCH returns 400 for missing fields', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });

    const response = await PATCH(makeRequest({ action: 'markAsRead' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing required fields');
  });
});
