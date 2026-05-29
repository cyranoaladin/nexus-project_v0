import {
  canSendMessageToReceiver,
  sanitizeMessage,
  sanitizeMessageUser,
} from '@/lib/security/message-access';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn() },
    student: { findUnique: jest.fn() },
    parentProfile: { findFirst: jest.fn() },
    coachStudentAssignment: { findFirst: jest.fn() },
  },
}));

describe('message-access security helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows staff to contact any other user but not self', async () => {
    await expect(
      canSendMessageToReceiver({
        senderUserId: 'admin-1',
        senderRole: 'ADMIN',
        receiverUserId: 'parent-1',
        receiverRole: 'PARENT',
      })
    ).resolves.toBe(true);

    await expect(
      canSendMessageToReceiver({
        senderUserId: 'admin-1',
        senderRole: 'ADMIN',
        receiverUserId: 'admin-1',
        receiverRole: 'ADMIN',
      })
    ).resolves.toBe(false);
  });

  it('requires active assignment for student to coach messages', async () => {
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1' });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      canSendMessageToReceiver({
        senderUserId: 'student-user-1',
        senderRole: 'ELEVE',
        receiverUserId: 'coach-user-1',
        receiverRole: 'COACH',
      })
    ).resolves.toBe(false);

    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'assignment-1' });

    await expect(
      canSendMessageToReceiver({
        senderUserId: 'student-user-1',
        senderRole: 'ELEVE',
        receiverUserId: 'coach-user-1',
        receiverRole: 'COACH',
      })
    ).resolves.toBe(true);
  });

  it('requires a child assignment for parent to coach messages', async () => {
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1' });
    (prisma.parentProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      canSendMessageToReceiver({
        senderUserId: 'parent-user-1',
        senderRole: 'PARENT',
        receiverUserId: 'coach-user-1',
        receiverRole: 'COACH',
      })
    ).resolves.toBe(false);

    (prisma.parentProfile.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'parent-profile-1' });

    await expect(
      canSendMessageToReceiver({
        senderUserId: 'parent-user-1',
        senderRole: 'PARENT',
        receiverUserId: 'coach-user-1',
        receiverRole: 'COACH',
      })
    ).resolves.toBe(true);
  });

  it('projects users and messages without sensitive fields or raw file URLs', () => {
    const user = sanitizeMessageUser({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'PARENT',
      password: 'hash',
      activationToken: 'token',
    } as any);

    expect(user).toEqual({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'PARENT',
    });

    const message = sanitizeMessage({
      id: 'message-1',
      content: 'Bonjour',
      fileUrl: '/var/www/private.pdf',
      fileName: 'private.pdf',
      sender: {
        id: 'sender-1',
        firstName: 'S',
        lastName: 'One',
        role: 'COACH',
        password: 'hash',
      } as any,
      receiver: {
        id: 'receiver-1',
        firstName: 'R',
        lastName: 'Two',
        role: 'PARENT',
        resetToken: 'token',
      } as any,
    } as any);

    expect(message).not.toHaveProperty('fileUrl');
    expect(message.hasAttachment).toBe(true);
    expect(message.sender).not.toHaveProperty('password');
    expect(message.receiver).not.toHaveProperty('resetToken');
    expect(JSON.stringify(message)).not.toContain('/var/www');
  });
});
