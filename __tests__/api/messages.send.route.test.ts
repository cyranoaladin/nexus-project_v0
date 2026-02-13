import { POST } from '@/app/api/messages/send/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    message: { create: jest.fn() },
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/messages/send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Authentification');
  });

  it('returns 404 when receiver missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ receiverId: 'user-2', content: 'Hi' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Destinataire');
  });

  it('returns 400 on invalid payload', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    });

    const response = await POST(makeRequest({ receiverId: 'user-2', content: '' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données invalides');
  });

  it('blocks student to non coach/assistant', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-2',
      role: 'PARENT',
    });

    const response = await POST(makeRequest({ receiverId: 'user-2', content: 'Hi' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('Communication');
  });

  it('creates message when allowed', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-2',
      role: 'COACH',
    });
    (prisma.message.create as jest.Mock).mockResolvedValue({
      id: 'm1',
      content: 'Hi',
      fileUrl: null,
      fileName: null,
      createdAt: new Date(),
      sender: { id: 'user-1', firstName: 'A', lastName: 'B', role: 'ELEVE' },
      receiver: { id: 'user-2', firstName: 'C', lastName: 'D', role: 'COACH' },
    });

    const response = await POST(makeRequest({ receiverId: 'user-2', content: 'Hi' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message.id).toBe('m1');
  });

  it('allows coach to send with attachment fields', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-3', role: 'COACH' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-4',
      role: 'PARENT',
    });
    (prisma.message.create as jest.Mock).mockResolvedValue({
      id: 'm2',
      content: 'File',
      fileUrl: 'https://files.local/f.pdf',
      fileName: 'f.pdf',
      createdAt: new Date(),
      sender: { id: 'user-3', firstName: 'E', lastName: 'F', role: 'COACH' },
      receiver: { id: 'user-4', firstName: 'G', lastName: 'H', role: 'PARENT' },
    });

    const response = await POST(
      makeRequest({ receiverId: 'user-4', content: 'File', fileUrl: 'https://files.local/f.pdf', fileName: 'f.pdf' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message.fileUrl).toBe('https://files.local/f.pdf');
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderId: 'user-3',
          receiverId: 'user-4',
          fileUrl: 'https://files.local/f.pdf',
          fileName: 'f.pdf',
        }),
      })
    );
  });
});
