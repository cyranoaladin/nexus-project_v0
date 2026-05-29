import { auth } from '@/auth';
import { POST } from '@/app/api/messages/send/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    student: { findUnique: jest.fn() },
    coachProfile: { findUnique: jest.fn() },
    parentProfile: { findFirst: jest.fn() },
    coachStudentAssignment: { findFirst: jest.fn() },
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
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Authentification');
  });

  it('returns 404 when receiver missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ receiverId: 'user-2', content: 'Hi' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Destinataire');
  });

  it('returns 400 on invalid payload', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    });

    const response = await POST(makeRequest({ receiverId: 'user-2', content: '' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données invalides');
  });

  it('blocks student to non coach/assistant', async () => {
    (auth as jest.Mock).mockResolvedValue({
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

  it('ignores body senderId and blocks coach to unassigned student', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-user-1', role: 'COACH' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-user-2',
      role: 'ELEVE',
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1' });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-2' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(
      makeRequest({
        senderId: 'admin-user',
        receiverId: 'student-user-2',
        content: 'Hi',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('Communication');
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('rejects arbitrary fileUrl attachments', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ASSISTANTE' },
    });

    const response = await POST(
      makeRequest({
        receiverId: 'user-2',
        content: 'File',
        fileUrl: 'https://attacker.test/file.pdf',
        fileName: 'file.pdf',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données invalides');
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('creates message when allowed', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-2',
      role: 'COACH',
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-2' });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' });
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
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderId: 'user-1',
          receiverId: 'user-2',
        }),
      })
    );
  });

  it('allows coach to send to parent of assigned student without returning sensitive user fields', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'user-3', role: 'COACH' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-4',
      role: 'PARENT',
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-3' });
    (prisma.parentProfile.findFirst as jest.Mock).mockResolvedValue({ id: 'parent-profile-4' });
    (prisma.message.create as jest.Mock).mockResolvedValue({
      id: 'm2',
      content: 'Bonjour',
      fileUrl: null,
      fileName: null,
      createdAt: new Date(),
      sender: { id: 'user-3', firstName: 'E', lastName: 'F', role: 'COACH', password: 'hash' },
      receiver: { id: 'user-4', firstName: 'G', lastName: 'H', role: 'PARENT', activationToken: 'token' },
    });

    const response = await POST(
      makeRequest({ receiverId: 'user-4', content: 'Bonjour' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message.sender).not.toHaveProperty('password');
    expect(body.message.receiver).not.toHaveProperty('activationToken');
    expect(JSON.stringify(body)).not.toContain('fileUrl');
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderId: 'user-3',
          receiverId: 'user-4',
          fileUrl: null,
          fileName: null,
        }),
      })
    );
  });
});
