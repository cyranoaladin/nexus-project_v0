import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';
import { sendWelcomeParentEmail, sendExistingAccountBilanEmail } from '../../lib/email';
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
  captureContactLead: jest.fn().mockResolvedValue({ id: 'lead-existing-123' }),
  ContactLeadValidationError: class ContactLeadValidationError extends Error {},
}));

const mockSendWelcomeParentEmail = sendWelcomeParentEmail as jest.Mock;
const mockSendExistingAccountBilanEmail = sendExistingAccountBilanEmail as jest.Mock;
const mockCaptureContactLead = captureContactLead as jest.Mock;

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
    expect(body.success).toBe(true);
    expect(body.message).toBe('Votre demande a bien été enregistrée. Vous allez recevoir un e-mail avec la marche à suivre.');
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

  describe('when the parent email already belongs to an existing account (H1-H4 hotfix)', () => {
    function mockExistingParent() {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'existing-user-123',
        email: 'jean.dupont@test.com',
      } as never);
      jest.spyOn(prisma.parentProfile, 'findUnique').mockResolvedValue({
        id: 'existing-parent-profile-123',
        children: [{ id: 'existing-student-123' }],
      } as never);
    }

    it('returns a response indistinguishable from the account-creation success response', async () => {
      mockExistingParent();

      const response = await POST(buildRequest(validRequestData));
      const body = await response.json();

      // Same status, same shape, same message as the "new account" success path —
      // an attacker probing this public endpoint must not be able to tell the two apart.
      expect(response.status).toBe(200);
      expect(body).toEqual({
        success: true,
        message: 'Votre demande a bien été enregistrée. Vous allez recevoir un e-mail avec la marche à suivre.',
        parentId: expect.any(String),
        studentId: expect.any(String),
      });
      expect(body.error).toBeUndefined();

      // No second account is ever created for an email that already exists.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('fires an internal notification without any minor PII', async () => {
      mockExistingParent();

      await POST(buildRequest(validRequestData));

      expect(mockCaptureContactLead).toHaveBeenCalledTimes(1);
      const leadPayload = mockCaptureContactLead.mock.calls[0][0];

      // Parent identity/contact channel: allowed.
      expect(leadPayload.email).toBe(validRequestData.parentEmail);
      expect(leadPayload.phone).toBe(validRequestData.parentPhone);
      expect(leadPayload.source).toBe('bilan-gratuit-existing-account');

      // No minor PII anywhere in the payload: no student first name, no grade, no school.
      const serializedPayload = JSON.stringify(leadPayload);
      expect(serializedPayload).not.toContain(validRequestData.studentFirstName);
      expect(serializedPayload).not.toContain(validRequestData.studentGrade);
      expect(serializedPayload).not.toContain(validRequestData.studentSchool);
    });

    it('sends the existing parent a coherent access email, not an error and not a duplicate-account invite', async () => {
      mockExistingParent();

      await POST(buildRequest(validRequestData));

      expect(mockSendExistingAccountBilanEmail).toHaveBeenCalledWith(
        'jean.dupont@test.com',
        'Jean Dupont',
      );
      expect(mockSendWelcomeParentEmail).not.toHaveBeenCalled();
    });
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
