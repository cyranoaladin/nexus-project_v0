import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';
import { sendWelcomeParentEmail } from '../../lib/email';

jest.mock('bcryptjs');

jest.mock('../../lib/rate-limit', () => ({
  guardRateLimit: jest.fn().mockReturnValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('test-cuid-123'),
}));

jest.mock('../../lib/email', () => ({
  sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockSendWelcomeParentEmail = sendWelcomeParentEmail as jest.Mock;

describe('/api/bilan-gratuit', () => {
  const validRequestData = {
    parentFirstName: 'Jean',
    parentLastName: 'Dupont',
    parentEmail: 'jean.dupont@test.com',
    parentPhone: '0123456789',
    studentFirstName: 'Marie',
    studentLastName: 'Dupont',
    studentGrade: 'Terminale',
    studentSchool: 'Lycée Victor Hugo',
    studentBirthDate: '2005-06-15',
    subjects: ['MATHEMATIQUES'],
    currentLevel: 'Moyen',
    objectives: 'Améliorer les notes en mathématiques pour le baccalauréat',
    difficulties: 'Difficultés avec les équations du second degré',
    preferredModality: 'hybride',
    availability: 'Mercredi après-midi et weekend',
    acceptTerms: true,
    acceptNewsletter: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost:3000/api/bilan-gratuit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('creates inactive parent/student records and sends an activation link without password', async () => {
    const userCreate = jest.fn()
      .mockResolvedValueOnce({
      id: 'parent-123',
      email: 'jean.dupont@test.com',
      firstName: 'Jean',
      lastName: 'Dupont',
      })
      .mockResolvedValueOnce({
        id: 'student-123',
        email: 'marie.dupont.test@nexus-student.local',
        firstName: 'Marie',
        lastName: 'Dupont',
      });
    const parentProfileCreate = jest.fn().mockResolvedValue({ id: 'parent-profile-123' });
    const studentCreate = jest.fn().mockResolvedValue({
      id: 'student-profile-123',
      parentId: 'parent-profile-123',
      userId: 'student-123',
      grade: 'Terminale',
    });

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback({
        user: { create: userCreate },
        parentProfile: { create: parentProfileCreate },
        student: { create: studentCreate },
      } as any);
    });

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Votre demande a bien été enregistrée. Un lien d’activation a été envoyé.');
    expect(body.parentId).toBe('parent-123');
    expect(body.studentId).toBe('student-profile-123');

    expect(userCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'jean.dupont@test.com',
          password: null,
          activatedAt: null,
          activationToken: expect.any(String),
          activationExpiry: expect.any(Date),
        }),
      }),
    );
    expect(userCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'marie.dupont.test@nexus-student.local',
          password: null,
          activatedAt: null,
        }),
      }),
    );
    expect(studentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'student-123',
          parentId: 'parent-profile-123',
          gradeLevel: 'TERMINALE',
        }),
      }),
    );
    expect(mockSendWelcomeParentEmail).toHaveBeenCalledWith(
      'jean.dupont@test.com',
      'Jean Dupont',
      'Marie Dupont',
      expect.stringContaining('/auth/activate?token='),
    );
  });

  it('ignores an injected parentPassword and still creates inactive accounts', async () => {
    const userCreate = jest.fn()
      .mockResolvedValueOnce({
      id: 'parent-123',
      email: 'jean.dupont@test.com',
      firstName: 'Jean',
      lastName: 'Dupont',
      })
      .mockResolvedValueOnce({
        id: 'student-123',
        email: 'marie.dupont.test@nexus-student.local',
        firstName: 'Marie',
        lastName: 'Dupont',
      });
    const parentProfileCreate = jest.fn().mockResolvedValue({ id: 'parent-profile-123' });
    const studentCreate = jest.fn().mockResolvedValue({
      id: 'student-profile-123',
    });

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback({
        user: { create: userCreate },
        parentProfile: { create: parentProfileCreate },
        student: { create: studentCreate },
      } as any);
    });

    const response = await POST(buildRequest({
      ...validRequestData,
      parentPassword: 'temporary-password-should-not-be-used',
    }));

    expect(response.status).toBe(200);
    expect(userCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ password: null }) }));
    expect(userCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ password: null }) }));
    expect(studentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gradeLevel: 'TERMINALE',
        }),
      }),
    );
  });

  it('returns 400 when parent email already exists', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'existing-user',
      email: 'jean.dupont@test.com',
    } as never);

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Un compte existe déjà avec cet email');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 400 when validation fails (invalid email)', async () => {
    const response = await POST(buildRequest({
      ...validRequestData,
      parentEmail: 'invalid-email',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données invalides');
  });

  it('returns 400 when validation fails (too short password if injected)', async () => {
    const response = await POST(buildRequest({
      ...validRequestData,
      parentPassword: '1234567',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données invalides');
  });

  it('returns 500 when database error occurs', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
    jest.spyOn(prisma, '$transaction').mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erreur interne du serveur');
  });

  it('continues even if email sending fails', async () => {
    mockSendWelcomeParentEmail.mockRejectedValueOnce(new Error('Email service unavailable'));

    const userCreate = jest.fn()
      .mockResolvedValueOnce({
      id: 'parent-123',
      email: 'jean.dupont@test.com',
      firstName: 'Jean',
      lastName: 'Dupont',
      })
      .mockResolvedValueOnce({
        id: 'student-123',
        email: 'marie.dupont.test@nexus-student.local',
        firstName: 'Marie',
        lastName: 'Dupont',
      });
    const parentProfileCreate = jest.fn().mockResolvedValue({ id: 'parent-profile-123' });
    const studentCreate = jest.fn().mockResolvedValue({
      id: 'student-profile-123',
    });

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback({
        user: { create: userCreate },
        parentProfile: { create: parentProfileCreate },
        student: { create: studentCreate },
      } as any);
    });

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
