import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';
import { sendMail } from '../../lib/email/mailer';

jest.mock('../../lib/rate-limit', () => ({
  guardRateLimit: jest.fn().mockReturnValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));

jest.mock('../../lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

const mockSendMail = sendMail as jest.Mock;

describe('/api/bilan-gratuit', () => {
  const validRequestData = {
    parentFirstName: 'Jean',
    parentLastName: 'Dupont',
    parentEmail: 'jean.dupont@test.com',
    parentPhone: '0123456789',
    studentFirstName: 'Marie',
    studentGrade: 'terminale',
    studentSchool: 'Lycée Victor Hugo',
    subjects: ['MATHEMATIQUES'],
    objectives: 'Améliorer les notes en mathématiques pour le baccalauréat',
    difficulties: 'Difficultés avec les équations du second degré',
    acceptTerms: true,
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

  it('creates a ContactLead in NOUVEAU status without creating a User account', async () => {
    const contactLeadCreate = jest.fn().mockResolvedValue({
      id: 'lead-123',
      name: 'Jean Dupont',
      email: 'jean.dupont@test.com',
      phone: '0123456789',
      profile: 'terminale · Marie · Lycée Victor Hugo',
      interest: 'MATHEMATIQUES',
      urgency: null,
      source: 'bilan-gratuit',
      createdAt: new Date('2026-07-27T12:00:00.000Z'),
    });
    jest.spyOn(prisma.contactLead, 'create').mockImplementation(contactLeadCreate as never);
    const userCreate = jest.spyOn(prisma.user, 'create');

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.leadId).toBe('lead-123');
    expect(body.parentId).toBeUndefined();
    expect(body.studentId).toBeUndefined();
    expect(body.message).toMatch(/demande.*enregistrée/i);

    expect(contactLeadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Jean Dupont',
        email: 'jean.dupont@test.com',
        phone: '0123456789',
        status: 'NOUVEAU',
        source: 'bilan-gratuit',
        studentFirstName: 'Marie',
        gradeLevel: 'terminale',
        establishment: 'Lycée Victor Hugo',
        subjects: ['MATHEMATIQUES'],
        mainNeed: 'Améliorer les notes en mathématiques pour le baccalauréat',
        message: 'Difficultés avec les équations du second degré',
        consentAt: expect.any(Date),
      }),
    });
    expect(userCreate).not.toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalled();
  });

  it('persists campaign context and offer code on the same lead', async () => {
    const contactLeadCreate = jest.fn().mockResolvedValue({
      id: 'lead-456',
      name: 'Jean Dupont',
      email: 'jean.dupont@test.com',
      phone: '0123456789',
      profile: null,
      interest: 'PACK_2 · PREMIERE · MATHEMATIQUES, FRANCAIS',
      urgency: null,
      source: 'pre-rentree-2026',
      createdAt: new Date('2026-07-27T12:00:00.000Z'),
    });
    jest.spyOn(prisma.contactLead, 'create').mockImplementation(contactLeadCreate as never);

    const response = await POST(
      buildRequest({
        ...validRequestData,
        studentGrade: 'premiere',
        subjects: ['MATHEMATIQUES', 'FRANCAIS'],
        offerId: 'pre2026-foundations-1re-pack2',
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
      }),
    );

    expect(response.status).toBe(200);
    expect(contactLeadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'NOUVEAU',
        source: 'pre-rentree-2026',
        interest: 'PACK_2 · PREMIERE · MATHEMATIQUES, FRANCAIS',
        offerCode: 'pre2026-foundations-1re-pack2',
        campaignContext: expect.objectContaining({
          programme: 'pre-rentree-2026',
          packCode: 'PACK_2',
          level: 'PREMIERE',
        }),
        subjects: ['MATHEMATIQUES', 'FRANCAIS'],
        gradeLevel: 'premiere',
      }),
    });
  });

  it('ignores an injected parentPassword and still creates a lead only', async () => {
    const contactLeadCreate = jest.fn().mockResolvedValue({
      id: 'lead-789',
      name: 'Jean Dupont',
      email: 'jean.dupont@test.com',
      phone: '0123456789',
      profile: null,
      interest: 'MATHEMATIQUES',
      urgency: null,
      source: 'bilan-gratuit',
      createdAt: new Date('2026-07-27T12:00:00.000Z'),
    });
    jest.spyOn(prisma.contactLead, 'create').mockImplementation(contactLeadCreate as never);
    const userCreate = jest.spyOn(prisma.user, 'create');

    const response = await POST(
      buildRequest({
        ...validRequestData,
        parentPassword: 'temporary-password-should-not-be-used',
      }),
    );

    expect(response.status).toBe(200);
    expect(contactLeadCreate).toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
    expect(contactLeadCreate.mock.calls[0][0].data).not.toHaveProperty('password');
  });

  it('allows a request even when a User already exists with the same email', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'existing-user',
      email: 'jean.dupont@test.com',
    } as never);
    const contactLeadCreate = jest.fn().mockResolvedValue({
      id: 'lead-existing',
      name: 'Jean Dupont',
      email: 'jean.dupont@test.com',
      phone: '0123456789',
      profile: null,
      interest: 'MATHEMATIQUES',
      urgency: null,
      source: 'bilan-gratuit',
      createdAt: new Date('2026-07-27T12:00:00.000Z'),
    });
    jest.spyOn(prisma.contactLead, 'create').mockImplementation(contactLeadCreate as never);

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.leadId).toBe('lead-existing');
    expect(contactLeadCreate).toHaveBeenCalled();
  });

  it('returns 400 when validation fails (invalid email)', async () => {
    const response = await POST(
      buildRequest({
        ...validRequestData,
        parentEmail: 'invalid-email',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données invalides');
  });

  it('returns 500 when database error occurs', async () => {
    jest.spyOn(prisma.contactLead, 'create').mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erreur interne du serveur');
  });

  it('continues even if CRM notification email fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('Email service unavailable'));
    const contactLeadCreate = jest.fn().mockResolvedValue({
      id: 'lead-mail-fail',
      name: 'Jean Dupont',
      email: 'jean.dupont@test.com',
      phone: '0123456789',
      profile: null,
      interest: 'MATHEMATIQUES',
      urgency: null,
      source: 'bilan-gratuit',
      createdAt: new Date('2026-07-27T12:00:00.000Z'),
    });
    jest.spyOn(prisma.contactLead, 'create').mockImplementation(contactLeadCreate as never);

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.leadId).toBe('lead-mail-fail');
  });
});
