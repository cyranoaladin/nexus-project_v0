import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';
import { sendMail } from '../../lib/email/mailer';
import { withParentStudentConsentTransaction } from '../../lib/bilans/parent-student-consent';

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

jest.mock('../../lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../../lib/bilans/parent-student-consent', () => ({
  withParentStudentConsentTransaction: jest.fn(),
}));

const mockSendMail = sendMail as jest.Mock;
const mockWithParentStudentConsentTransaction = withParentStudentConsentTransaction as jest.MockedFunction<
  typeof withParentStudentConsentTransaction
>;
const mockPreparePending = jest.fn();
const mockConsentTransactionImplementation: typeof withParentStudentConsentTransaction = (
  database,
  action,
) => database.$transaction((transaction) => action({
  transaction,
  preparePending: mockPreparePending,
  verify: jest.fn(),
  getStatus: jest.fn(),
}));

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
    mockPreparePending.mockResolvedValue({
      id: 'canonical-link-123',
      state: 'PENDING_PARENT_CONSENT',
      consentedAt: null,
      verifiedAt: null,
    });
    mockWithParentStudentConsentTransaction.mockImplementation(mockConsentTransactionImplementation);
    process.env.NEXTAUTH_URL = 'https://nexus.test';
  });

  afterAll(() => {
    delete process.env.NEXTAUTH_URL;
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

    const response = await POST(buildRequest({
      ...validRequestData,
      campaignContext: null,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Si la demande peut etre traitee');
    expect(body).not.toHaveProperty('parentId');
    expect(body).not.toHaveProperty('studentId');
    expect(response.headers.get('Cache-Control')).toContain('no-store');

    expect(userCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'jean.dupont@test.com',
          password: null,
          activatedAt: null,
          activationToken: expect.stringMatching(/^[a-f0-9]{64}$/),
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
    expect(mockWithParentStudentConsentTransaction).toHaveBeenCalledWith(
      prisma,
      expect.any(Function),
    );
    expect(mockPreparePending).toHaveBeenCalledWith({
      parentUserId: 'parent-123',
      studentId: 'student-profile-123',
      now: expect.any(Date),
    });
    expect(mockPreparePending).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'jean.dupont@test.com',
      subject: expect.any(String),
      html: expect.stringContaining('https://nexus.test/auth/activate?token='),
      text: expect.stringContaining('https://nexus.test/auth/activate?token='),
    }));
    const storedTokenHash = userCreate.mock.calls[0][0].data.activationToken;
    const mailPayload = mockSendMail.mock.calls[0][0];
    expect(mailPayload.html).not.toContain(storedTokenHash);
    expect(mailPayload.text).not.toMatch(/mot de passe temporaire/i);
  });

  it('never persists a campaign lead from a submitted campaignContext (Stage/Bilan boundary fail-closed)', async () => {
    // The Pré-rentrée Stage/Bilan integration is fail-closed
    // (canPrefillBilanGratuitFromPreRentree), independent from the Stage's
    // PUBLIC_READY status. A crafted or replayed campaignContext in the POST
    // body must never create a ContactLead server-side, even though the
    // shape is otherwise valid.
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
    const contactLeadCreate = jest.fn().mockResolvedValue({ id: 'lead-123' });

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      if (typeof callback !== 'function') throw new Error('Transaction callback required');
      return callback({
        user: { create: userCreate },
        parentProfile: { create: jest.fn().mockResolvedValue({ id: 'parent-profile-123' }) },
        student: { create: jest.fn().mockResolvedValue({ id: 'student-profile-123' }) },
        contactLead: { create: contactLeadCreate },
      } as never);
    });

    const response = await POST(buildRequest({
      ...validRequestData,
      studentGrade: 'Première',
      subjects: ['MATHEMATIQUES', 'FRANCAIS'],
      campaignContext: {
        programme: 'pre-rentree-2026',
        packCode: 'PACK_1',
        level: 'PREMIERE',
        subjectIds: ['MATHEMATIQUES'],
        profile: {
          voie: 'GENERALE',
          mathsProfile: 'MATHS_EDS',
          eafProfile: 'EAF_GENERALE',
          premiereSpecialtyPlan: 'NSI_PHYSIQUE_CHIMIE',
        },
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(contactLeadCreate).not.toHaveBeenCalled();
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

  it('returns the same non-enumerating response when parent email already exists', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'existing-user',
      email: 'jean.dupont@test.com',
    } as never);

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Si la demande peut etre traitee');
    expect(body).not.toHaveProperty('error');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
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

  it('aborts registration and sends no email when pending consent preparation fails', async () => {
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

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback({
      user: { create: userCreate },
      parentProfile: { create: jest.fn().mockResolvedValue({ id: 'parent-profile-123' }) },
      student: { create: jest.fn().mockResolvedValue({ id: 'student-profile-123' }) },
    } as any));
    mockPreparePending.mockRejectedValueOnce(new Error('pending link failed'));

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erreur interne du serveur');
    expect(mockPreparePending).toHaveBeenCalledWith({
      parentUserId: 'parent-123',
      studentId: 'student-profile-123',
      now: expect.any(Date),
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('continues even if email sending fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSendMail.mockRejectedValueOnce(new Error('recognizable-raw-token-must-not-leak'));

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
    expect(JSON.stringify(body)).not.toContain('recognizable-raw-token-must-not-leak');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('recognizable-raw-token-must-not-leak');
    consoleError.mockRestore();
  });

  it('ignores a hostile Host header when building the activation email', async () => {
    const userCreate = jest.fn()
      .mockResolvedValueOnce({ id: 'parent-host', email: 'jean.dupont@test.com', firstName: 'Jean', lastName: 'Dupont' })
      .mockResolvedValueOnce({ id: 'student-host', email: 'marie@nexus-student.local', firstName: 'Marie', lastName: 'Dupont' });
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback({
      user: { create: userCreate },
      parentProfile: { create: jest.fn().mockResolvedValue({ id: 'parent-profile-host' }) },
      student: { create: jest.fn().mockResolvedValue({ id: 'student-profile-host' }) },
    } as any));

    const request = new NextRequest('http://attacker.example/api/bilan-gratuit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: 'attacker.example' },
      body: JSON.stringify(validRequestData),
    });
    const response = await POST(request);
    const mail = mockSendMail.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(mail.html).toContain('https://nexus.test/auth/activate?token=');
    expect(mail.html).not.toContain('attacker.example');
  });

  it('treats a concurrent parent email uniqueness race as the same public success', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
    jest.spyOn(prisma, '$transaction').mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).not.toHaveProperty('error');
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
