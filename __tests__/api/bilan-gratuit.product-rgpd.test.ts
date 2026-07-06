import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bilan-gratuit/route';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { sendMail } from '@/lib/email/mailer';
import { ASSESSMENT_FLOW_COOKIE_NAME } from '@/lib/assessments/public-token';

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));

jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

const mockGuardRateLimit = guardRateLimitAsync as jest.Mock;
const mockContactLeadCreate = prisma.contactLead.create as jest.Mock;
const mockSendMail = sendMail as jest.Mock;

const validLeadPayload = {
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

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/bilan-gratuit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function expectNoPublicIdentifiers(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const field of [
    'leadId',
    'parentId',
    'studentId',
    'activationToken',
    'activationUrl',
    'tokenHash',
    'password',
  ]) {
    expect(serialized).not.toContain(field);
  }
}

describe('/api/bilan-gratuit product/RGPD lead-only decision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuardRateLimit.mockResolvedValue(null);
    mockContactLeadCreate.mockResolvedValue({
      id: 'lead_123',
      name: 'Jean Dupont',
      email: 'jean.dupont@test.com',
      phone: '+216 99 19 28 29',
      profile: 'Parent',
      interest: 'Bilan gratuit - Terminale',
      urgency: 'Moyen',
      source: 'bilan-gratuit',
      status: 'NEW',
      notes: 'lead notes',
      createdAt: new Date('2026-07-03T08:00:00.000Z'),
      updatedAt: new Date('2026-07-03T08:00:00.000Z'),
    });
    mockSendMail.mockResolvedValue({ ok: true });
  });

  it('creates a CRM lead only and does not create inactive accounts', async () => {
    const response = await POST(request(validLeadPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Votre demande a bien été enregistrée. Notre équipe vous recontactera pour la suite.',
    });
    expect(mockContactLeadCreate).toHaveBeenCalledTimes(1);
    expect(mockContactLeadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Jean Dupont',
        email: 'jean.dupont@test.com',
        phone: '+216 99 19 28 29',
        profile: 'Parent',
        interest: 'Bilan gratuit - Terminale',
        source: 'bilan-gratuit',
        status: 'NEW',
      }),
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.parentProfile.create).not.toHaveBeenCalled();
    expect(prisma.student.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expectNoPublicIdentifiers(body);
  });

  it('sets a signed HttpOnly assessment flow cookie without exposing token or IDs in JSON', async () => {
    const response = await POST(request(validLeadPayload));
    const body = await response.json();
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(setCookie).toContain(`${ASSESSMENT_FLOW_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/bilan-gratuit/assessment');
    expect(JSON.stringify(body)).not.toContain(ASSESSMENT_FLOW_COOKIE_NAME);
    expect(JSON.stringify(body)).not.toContain('assessmentPublicToken');
    expectNoPublicIdentifiers(body);
  });

  it('does not persist birth date in CRM notes', async () => {
    await POST(request(validLeadPayload));

    const notes = mockContactLeadCreate.mock.calls[0][0].data.notes;
    expect(notes).not.toContain('2008-06-15');
    expect(notes).not.toContain('birthDate');
  });

  it('returns neutral success for an existing account email without enumeration', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-user',
      email: validLeadPayload.parentEmail,
    });

    const response = await POST(request(validLeadPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expectNoPublicIdentifiers(body);
  });

  it('returns a neutral success for honeypot submissions without DB writes', async () => {
    const response = await POST(request({ ...validLeadPayload, honeypot: 'bot' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockContactLeadCreate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expectNoPublicIdentifiers(body);
  });

  it('returns 429 before any DB write when rate limited', async () => {
    mockGuardRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'RATE_LIMIT' }), { status: 429 }),
    );

    const response = await POST(request(validLeadPayload));

    expect(response.status).toBe(429);
    expect(mockContactLeadCreate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads with a sober 400', async () => {
    const response = await POST(request({ ...validLeadPayload, acceptTerms: false }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Données invalides' });
    expect(mockContactLeadCreate).not.toHaveBeenCalled();
    expectNoPublicIdentifiers(body);
  });

  it('keeps internal notification failure logs sober', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSendMail.mockRejectedValueOnce(new Error('SMTP stack should not leak'));

    try {
      const response = await POST(request(validLeadPayload));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      const serializedLogs = JSON.stringify(consoleSpy.mock.calls);
      expect(serializedLogs).not.toContain('stack');
      expect(serializedLogs).not.toContain('__tests__/api/bilan-gratuit.product-rgpd.test.ts');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
