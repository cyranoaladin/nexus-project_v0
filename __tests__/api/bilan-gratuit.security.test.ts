import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bilan-gratuit/route';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { sendWelcomeParentEmail } from '@/lib/email';
import { sendMail } from '@/lib/email/mailer';

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('test-cuid-123'),
}));

jest.mock('@/lib/email', () => ({
  sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

const mockGuardRateLimit = guardRateLimitAsync as jest.Mock;
const mockSendWelcomeParentEmail = sendWelcomeParentEmail as jest.Mock;
const mockContactLeadCreate = prisma.contactLead.create as jest.Mock;
const mockSendMail = sendMail as jest.Mock;

const validRequestData = {
  parentFirstName: 'Jean',
  parentLastName: 'Dupont',
  parentEmail: 'jean.dupont@test.com',
  parentPhone: '+216 99 19 28 29',
  studentFirstName: 'Marie',
  studentLastName: 'Dupont',
  studentGrade: 'Terminale',
  studentSchool: 'Lycée Victor Hugo',
  subjects: ['MATHEMATIQUES'],
  currentLevel: 'Moyen',
  objectives: 'Améliorer les notes en mathématiques pour le baccalauréat',
  difficulties: 'Difficultés avec les équations du second degré',
  preferredModality: 'hybride',
  availability: 'Mercredi après-midi',
  acceptTerms: true,
  acceptNewsletter: false,
};

const forbiddenResponseFields = [
  'activationToken',
  'activationUrl',
  'password',
  'tokenHash',
  'stack',
  'localPath',
  'parentId',
  'studentId',
];

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/bilan-gratuit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function expectNoForbiddenFields(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const field of forbiddenResponseFields) {
    expect(serialized).not.toContain(field);
  }
}

describe('/api/bilan-gratuit security contract', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, { NODE_ENV: 'test' });
    mockGuardRateLimit.mockResolvedValue(null);
    mockSendWelcomeParentEmail.mockResolvedValue(undefined);
    mockContactLeadCreate.mockResolvedValue({
      id: 'lead-123',
      name: 'Jean Dupont',
      email: 'jean.dupont@test.com',
      phone: '+216 99 19 28 29',
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
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  });

  it('rejects invalid payloads with a sober 400', async () => {
    const response = await POST(buildRequest({ ...validRequestData, parentEmail: 'not-an-email' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Données invalides' });
    expectNoForbiddenFields(body);
  });

  it('returns a neutral success for honeypot submissions without creating accounts', async () => {
    const response = await POST(buildRequest({ ...validRequestData, website: 'https://bot.test' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWelcomeParentEmail).not.toHaveBeenCalled();
    expectNoForbiddenFields(body);
  });

  it('returns 429 before any DB work when rate limited', async () => {
    mockGuardRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'RATE_LIMIT' }), { status: 429 }),
    );

    const response = await POST(buildRequest(validRequestData));

    expect(response.status).toBe(429);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns a neutral success for an existing email without account lookup enumeration', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-user',
      email: validRequestData.parentEmail,
    });

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Votre demande a bien été enregistrée. Notre équipe vous recontactera pour la suite.',
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWelcomeParentEmail).not.toHaveBeenCalled();
    expectNoForbiddenFields(body);
  });

  it('creates a CRM lead without creating inactive accounts or activation data', async () => {
    const response = await POST(buildRequest({ ...validRequestData, website: '' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockContactLeadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Jean Dupont',
        email: 'jean.dupont@test.com',
        source: 'bilan-gratuit',
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.parentProfile.create).not.toHaveBeenCalled();
    expect(prisma.student.create).not.toHaveBeenCalled();
    expect(mockSendWelcomeParentEmail).not.toHaveBeenCalled();
    expectNoForbiddenFields(body);
  });

  it('returns a sober 500 without stack or tokens on DB failure', async () => {
    mockContactLeadCreate.mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Erreur interne du serveur' });
    expect(mockSendWelcomeParentEmail).not.toHaveBeenCalled();
    expectNoForbiddenFields(body);
  });
});
