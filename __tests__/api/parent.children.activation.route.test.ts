/**
 * Tests P0-03: Child creation must stay inactive and use its own activation token.
 */

import { POST as createChild, GET as listChildren } from '@/app/api/parent/children/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import crypto from 'crypto';

jest.mock('@/auth');
jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ success: true }),
}));

import { sendMail as _sendMail } from '@/lib/email/mailer';
const mockSendMail = _sendMail as jest.Mock;

function mockParentSession(userId = 'parent-1') {
  (auth as jest.Mock).mockResolvedValue({
    user: { id: userId, role: 'PARENT', email: 'parent@example.com' },
  });
}

function req(body: object) {
  return new NextRequest('http://localhost/api/parent/children', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/parent/children — P0-03 hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParentSession();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
  });

  it('creates child with null password, null activation state and activation token', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const userCreate = jest.fn()
      .mockResolvedValueOnce({
        id: 'child-user-123',
        email: 'jean.dupont.1234@nexus-student.local',
        firstName: 'Jean',
        lastName: 'Dupont',
      });
    const studentCreate = jest.fn().mockResolvedValue({
      id: 'student-profile-123',
      grade: 'Terminale',
      school: 'Lycée',
      user: {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont.1234@nexus-student.local',
      },
    });

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
      const tx = {
        user: { create: userCreate },
        parentProfile: { create: jest.fn().mockResolvedValue({ id: 'parent-profile-1' }) },
        student: { create: studentCreate },
      };
      return callback(tx);
    });

    const response = await createChild(req({
      firstName: 'Jean',
      lastName: 'Dupont',
      grade: 'Terminale',
      school: 'Lycée',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.activation.activationUrl).toContain('/auth/activate?token=act_');
    expect(JSON.stringify(json)).not.toContain('activationToken');
    expect(JSON.stringify(json)).not.toContain('tokenHash');
    expect(json.activation).not.toHaveProperty('token');
    expect(json.activation.message).toContain('parent authentifié');
    expect(userCreate).toHaveBeenCalledTimes(1);
    expect(userCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        password: null,
        activatedAt: null,
        activationToken: expect.any(String),
        activationExpiry: expect.any(Date),
      }),
    }));
    expect(studentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        parentId: 'parent-profile-1',
        userId: 'child-user-123',
        gradeLevel: expect.any(String),
        academicTrack: expect.any(String),
      }),
    }));
  });

  it('stores a SHA-256 hash in DB, not the raw token', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const userCreate = jest.fn()
      .mockResolvedValueOnce({
        id: 'child-user-456',
        email: 'alice.martin@nexus-student.local',
        firstName: 'Alice',
        lastName: 'Martin',
      });
    const studentCreate = jest.fn().mockResolvedValue({
      id: 'student-456',
      grade: 'Seconde',
      school: '',
      user: { firstName: 'Alice', lastName: 'Martin', email: 'alice.martin@nexus-student.local' },
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
      cb({ user: { create: userCreate }, student: { create: studentCreate } })
    );

    const response = await createChild(req({ firstName: 'Alice', lastName: 'Martin', grade: 'Seconde' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    // The activationUrl contains the raw token
    const rawToken = new URL(json.activation.activationUrl).searchParams.get('token');
    expect(rawToken).toMatch(/^act_/);

    // The DB received the SHA-256 hash of the raw token — assert cryptographic relationship
    const storedToken = userCreate.mock.calls[0][0].data.activationToken;
    const expectedHash = crypto.createHash('sha256').update(rawToken!).digest('hex');
    expect(storedToken).toBe(expectedHash);
  });

  it('returns 401 for non-parent', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    const response = await createChild(req({ firstName: 'A', lastName: 'B', grade: 'Seconde' }));
    expect(response.status).toBe(401);
  });

  it('sends activation email to parent session email, with sanitized subject and text field', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const userCreate = jest.fn().mockResolvedValueOnce({
      id: 'child-user-789',
      email: 'marie.curie@nexus-student.local',
      firstName: 'Marie',
      lastName: 'Curie',
    });
    const studentCreate = jest.fn().mockResolvedValue({
      id: 'student-789',
      grade: 'Première',
      school: '',
      user: { firstName: 'Marie', lastName: 'Curie', email: 'marie.curie@nexus-student.local' },
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
      cb({ user: { create: userCreate }, student: { create: studentCreate } })
    );

    mockSendMail.mockClear();
    const response = await createChild(req({ firstName: 'Marie', lastName: 'Curie', grade: 'Première' }));
    expect(response.status).toBe(200);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mailArgs = mockSendMail.mock.calls[0][0];

    // to = parent session email, NOT synthetic student address
    expect(mailArgs.to).toBe('parent@example.com');
    expect(mailArgs.to).not.toContain('@nexus-student.local');

    // subject must not contain CR/LF
    expect(mailArgs.subject).not.toMatch(/[\r\n]/);

    // text field must be present
    expect(mailArgs.text).toBeDefined();
    expect(typeof mailArgs.text).toBe('string');
    expect(mailArgs.text.length).toBeGreaterThan(0);
  });
});
