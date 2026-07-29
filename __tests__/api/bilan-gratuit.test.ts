import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';
import { sendWelcomeParentEmail } from '../../lib/email';
import { captureContactLead } from '../../lib/crm/contact-leads';

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
  sendExistingAccountBilanEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/crm/contact-leads', () => ({
  captureContactLead: jest.fn().mockResolvedValue({ id: 'lead-123' }),
}));

const mockSendWelcomeParentEmail = sendWelcomeParentEmail as jest.Mock;
const mockCaptureContactLead = captureContactLead as jest.Mock;
const mockSendExistingAccountBilanEmail = (
  jest.requireMock('../../lib/email') as {
    sendExistingAccountBilanEmail: jest.Mock;
  }
).sendExistingAccountBilanEmail;

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

    const response = await POST(buildRequest({
      ...validRequestData,
      campaignContext: null,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
    });
    expect(body).not.toHaveProperty('parentId');
    expect(body).not.toHaveProperty('studentId');

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

  it('returns the exact same public response and Set-Cookie contract for new and existing accounts', async () => {
    const userCreate = jest.fn()
      .mockResolvedValueOnce({
        id: 'parent-123',
        email: validRequestData.parentEmail,
        firstName: validRequestData.parentFirstName,
        lastName: validRequestData.parentLastName,
      })
      .mockResolvedValueOnce({
        id: 'student-123',
        email: 'student.test@nexus-student.local',
        firstName: validRequestData.studentFirstName,
        lastName: validRequestData.studentLastName,
      });

    jest.spyOn(prisma.user, 'findUnique')
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        id: 'existing-user',
        email: validRequestData.parentEmail,
      } as never);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback: any) => callback({
      user: { create: userCreate },
      parentProfile: { create: jest.fn().mockResolvedValue({ id: 'parent-profile-123' }) },
      student: { create: jest.fn().mockResolvedValue({ id: 'student-profile-123' }) },
    } as any));

    const newAccountResponse = await POST(buildRequest(validRequestData));
    const newAccountBody = await newAccountResponse.json();
    const existingAccountResponse = await POST(buildRequest(validRequestData));
    const existingAccountBody = await existingAccountResponse.json();

    expect({
      status: existingAccountResponse.status,
      body: existingAccountBody,
      setCookie: existingAccountResponse.headers.get('set-cookie'),
    }).toEqual({
      status: newAccountResponse.status,
      body: newAccountBody,
      setCookie: newAccountResponse.headers.get('set-cookie'),
    });
    expect(existingAccountBody).toEqual({
      success: true,
      message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockSendExistingAccountBilanEmail).toHaveBeenCalledWith(
      validRequestData.parentEmail,
      `${validRequestData.parentFirstName} ${validRequestData.parentLastName}`,
    );
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
    expect(mockCaptureContactLead).not.toHaveBeenCalled();
  });

  describe('staff lead capture', () => {
    function mockSuccessfulCreation() {
      const userCreate = jest.fn()
        .mockResolvedValueOnce({
          id: 'parent-123',
          email: validRequestData.parentEmail,
          firstName: validRequestData.parentFirstName,
          lastName: validRequestData.parentLastName,
        })
        .mockResolvedValueOnce({
          id: 'student-123',
          email: 'student.test@nexus-student.local',
          firstName: validRequestData.studentFirstName,
          lastName: validRequestData.studentLastName,
        });

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as never);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback({
        user: { create: userCreate },
        parentProfile: { create: jest.fn().mockResolvedValue({ id: 'parent-profile-123' }) },
        student: { create: jest.fn().mockResolvedValue({ id: 'student-profile-123' }) },
      } as any));
    }

    it('captures only minimized parent coordinates after a valid new-account submission succeeds', async () => {
      mockSuccessfulCreation();

      const response = await POST(buildRequest({
        ...validRequestData,
        answers: ['réponse sensible'],
      }));

      expect(response.status).toBe(200);
      expect(mockCaptureContactLead).toHaveBeenCalledTimes(1);
      const leadPayload = mockCaptureContactLead.mock.calls[0][0];
      expect(leadPayload).toEqual({
        name: `${validRequestData.parentFirstName} ${validRequestData.parentLastName}`,
        email: validRequestData.parentEmail,
        phone: validRequestData.parentPhone,
        profile: 'Parent',
        interest: 'Bilan gratuit - nouvelle demande',
        source: 'bilan-gratuit',
        type: 'bilan_gratuit',
        consent: true,
      });

      const serializedPayload = JSON.stringify(leadPayload);
      for (const minorData of [
        validRequestData.studentFirstName,
        validRequestData.studentSchool,
        validRequestData.studentGrade,
        validRequestData.objectives,
        validRequestData.difficulties,
        'réponse sensible',
      ]) {
        expect(serializedPayload).not.toContain(minorData);
      }
    });

    it('captures a valid existing-account submission without exposing minor data', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'existing-user',
        email: validRequestData.parentEmail,
      } as never);

      const response = await POST(buildRequest(validRequestData));

      expect(response.status).toBe(200);
      expect(mockCaptureContactLead).toHaveBeenCalledTimes(1);
      const leadPayload = mockCaptureContactLead.mock.calls[0][0];
      expect(leadPayload).toEqual({
        name: `${validRequestData.parentFirstName} ${validRequestData.parentLastName}`,
        email: validRequestData.parentEmail,
        phone: validRequestData.parentPhone,
        profile: 'Parent',
        interest: 'Bilan gratuit - nouvelle demande',
        source: 'bilan-gratuit',
        type: 'bilan_gratuit',
        consent: true,
      });
      expect(JSON.stringify(leadPayload)).not.toContain(validRequestData.studentFirstName);
      expect(JSON.stringify(leadPayload)).not.toContain(validRequestData.studentSchool);
      expect(JSON.stringify(leadPayload)).not.toContain(validRequestData.studentGrade);
      expect(JSON.stringify(leadPayload)).not.toContain(validRequestData.objectives);
      expect(JSON.stringify(leadPayload)).not.toContain(validRequestData.difficulties);
    });

    it('does not capture invalid Zod payloads', async () => {
      const response = await POST(buildRequest({
        ...validRequestData,
        parentEmail: 'invalid-email',
      }));

      expect(response.status).toBe(400);
      expect(mockCaptureContactLead).not.toHaveBeenCalled();
    });

    it('does not capture honeypot submissions', async () => {
      const response = await POST(buildRequest({
        ...validRequestData,
        website: 'https://spam.example',
      }));

      expect(response.status).toBe(200);
      expect(mockCaptureContactLead).not.toHaveBeenCalled();
    });
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
