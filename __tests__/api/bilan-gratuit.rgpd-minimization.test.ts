import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bilan-gratuit/route';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';

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

describe('/api/bilan-gratuit RGPD minimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (guardRateLimitAsync as jest.Mock).mockResolvedValue(null);
    (prisma.contactLead.create as jest.Mock).mockResolvedValue({
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
  });

  it('rejects studentBirthDate from the public lead_only payload', async () => {
    const response = await POST(
      request({
        ...validLeadPayload,
        studentBirthDate: '2008-06-15',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Données invalides' });
    expect(prisma.contactLead.create).not.toHaveBeenCalled();
  });

  it('stores only callback lead information when no birth date is provided', async () => {
    const response = await POST(request(validLeadPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Votre demande a bien été enregistrée. Notre équipe vous recontactera pour la suite.',
    });
    expect(prisma.contactLead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Jean Dupont',
        email: 'jean.dupont@test.com',
        source: 'bilan-gratuit',
        status: 'NEW',
      }),
    });
    const notes = (prisma.contactLead.create as jest.Mock).mock.calls[0][0].data.notes;
    expect(notes).not.toContain('2008-06-15');
    expect(notes).not.toContain('birth');
    expect(notes).not.toContain('naissance');
  });
});
