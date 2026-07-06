import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';
import { sendWelcomeParentEmail } from '../../lib/email';
import { sendMail } from '@/lib/email/mailer';

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

jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

const mockSendWelcomeParentEmail = sendWelcomeParentEmail as jest.Mock;
const mockContactLeadCreate = prisma.contactLead.create as jest.Mock;
const mockSendMail = sendMail as jest.Mock;

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
    mockContactLeadCreate.mockResolvedValue({
      id: 'lead-123',
      name: 'Jean Dupont',
      email: 'jean.dupont@test.com',
      phone: '0123456789',
      profile: 'Parent',
      interest: 'Bilan gratuit - Terminale',
      urgency: 'Moyen',
      source: 'bilan-gratuit',
      status: 'NEW',
      notes: 'Lead notes',
      createdAt: new Date('2026-07-03T08:00:00.000Z'),
      updatedAt: new Date('2026-07-03T08:00:00.000Z'),
    });
    mockSendMail.mockResolvedValue({ ok: true });
  });

  function buildRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost:3000/api/bilan-gratuit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('creates a CRM lead without creating inactive parent/student accounts', async () => {
    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Votre demande a bien été enregistrée. Notre équipe vous recontactera pour la suite.');
    expect(body).not.toHaveProperty('parentId');
    expect(body).not.toHaveProperty('studentId');

    expect(mockContactLeadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Jean Dupont',
        email: 'jean.dupont@test.com',
        source: 'bilan-gratuit',
      }),
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.parentProfile.create).not.toHaveBeenCalled();
    expect(prisma.student.create).not.toHaveBeenCalled();
    expect(mockSendWelcomeParentEmail).not.toHaveBeenCalled();
  });

  it('rejects an injected parentPassword before creating inactive accounts', async () => {
    const response = await POST(buildRequest({
      ...validRequestData,
      parentPassword: 'temporary-password-should-not-be-used',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données invalides');
    expect(mockContactLeadCreate).not.toHaveBeenCalled();
  });

  it('returns a neutral success when parent email already exists', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'existing-user',
      email: 'jean.dupont@test.com',
    } as never);

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).not.toHaveProperty('error');
    expect(body).not.toHaveProperty('parentId');
    expect(body).not.toHaveProperty('studentId');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
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
    mockContactLeadCreate.mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erreur interne du serveur');
  });

  it('continues even if internal lead notification email fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('Email service unavailable'));

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockContactLeadCreate).toHaveBeenCalledTimes(1);
    expect(mockSendWelcomeParentEmail).not.toHaveBeenCalled();
  });
});
