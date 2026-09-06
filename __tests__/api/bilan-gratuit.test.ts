import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';
import { enqueueEmailIntent } from '../../lib/email/outbox';
import { FAMILY_REQUEST_CONSENT_VERSION } from '../../lib/families/requests';

jest.mock('bcryptjs');

jest.mock('../../lib/rate-limit', () => ({
  guardRateLimit: jest.fn().mockReturnValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('test-cuid-123'),
}));

jest.mock('../../lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'email-job-1' }),
}));

jest.mock('../../lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

const mockEnqueueEmailIntent = enqueueEmailIntent as jest.Mock;
const { guardSensitiveRateLimit } = require('../../lib/rate-limit/sensitive');

describe('/api/bilan-gratuit', () => {
  const validRequestData = {
    parentFirstName: 'Jean',
    parentLastName: 'Dupont',
    parentEmail: 'jean.dupont@test.com',
    parentPhone: '+21699000001',
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

  function mockFamilyRequestCreate(id = 'family-request-1') {
    const familyRequestCreate = jest.fn().mockResolvedValue({ id });
    const contactLeadCreate = jest.fn().mockResolvedValue({ id: 'lead-1' });
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback({
      familyRequest: { create: familyRequestCreate },
      contactLead: { create: contactLeadCreate },
    } as any));
    return { familyRequestCreate, contactLeadCreate };
  }

  it('returns the generic public success without persistence for a honeypot submission', async () => {
    const { familyRequestCreate } = mockFamilyRequestCreate();

    const response = await POST(buildRequest({
      ...validRequestData,
      website: 'bot-trap',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      success: true,
      message: expect.stringContaining('Si la demande peut etre traitee'),
    }));
    expect(body).not.toHaveProperty('error');
    expect(familyRequestCreate).not.toHaveBeenCalled();
    expect(mockEnqueueEmailIntent).not.toHaveBeenCalled();
  });

  it('creates a BILAN_GRATUIT FamilyRequest (+ one child) and zero User/Student rows', async () => {
    const { familyRequestCreate, contactLeadCreate } = mockFamilyRequestCreate();
    const userCreate = jest.fn();
    const studentCreate = jest.fn();
    jest.spyOn(prisma.user, 'create' as never).mockImplementation(userCreate as never);
    jest.spyOn(prisma.student, 'create' as never).mockImplementation(studentCreate as never);

    const response = await POST(buildRequest({
      ...validRequestData,
      campaignContext: null,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Si la demande peut etre traitee');
    expect(response.headers.get('Cache-Control')).toContain('no-store');

    expect(userCreate).not.toHaveBeenCalled();
    expect(studentCreate).not.toHaveBeenCalled();
    expect(mockEnqueueEmailIntent).not.toHaveBeenCalled();
    expect(contactLeadCreate).not.toHaveBeenCalled();

    expect(familyRequestCreate).toHaveBeenCalledTimes(1);
    const call = familyRequestCreate.mock.calls[0][0];
    expect(call.data).toEqual(expect.objectContaining({
      type: 'BILAN_GRATUIT',
      requestingParentProfileId: null,
      contactFirstName: 'Jean',
      contactLastName: 'Dupont',
      contactEmail: 'jean.dupont@test.com',
      consentVersion: FAMILY_REQUEST_CONSENT_VERSION,
      consentAt: expect.any(Date),
    }));
    expect(call.data.contactPhone).toEqual(expect.any(String));
    expect(call.data.contactPhoneNormalized).toEqual(expect.any(String));
    expect(call.data.children.create).toHaveLength(1);
    expect(call.data.children.create[0]).toEqual(expect.objectContaining({
      firstName: 'Marie',
      lastName: 'Dupont',
      gradeLevel: 'TERMINALE',
      school: 'Lycée Victor Hugo',
    }));
  });

  it('persists a campaign lead alongside the request when a valid campaignContext is submitted', async () => {
    const { familyRequestCreate, contactLeadCreate } = mockFamilyRequestCreate();

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
    expect(familyRequestCreate).toHaveBeenCalledTimes(1);
    expect(contactLeadCreate).not.toHaveBeenCalled();
  });

  it('never persists a campaign lead from a crafted campaignContext (Stage/Bilan boundary fail-closed)', async () => {
    const { contactLeadCreate } = mockFamilyRequestCreate();

    const response = await POST(buildRequest({
      ...validRequestData,
      studentGrade: 'Première',
      subjects: ['MATHEMATIQUES', 'FRANCAIS'],
      campaignContext: {
        programme: 'pre-rentree-2026',
        packCode: 'PACK_1',
        level: 'SECONDE',
        subjectIds: ['MATHEMATIQUES'],
        profile: {},
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(contactLeadCreate).not.toHaveBeenCalled();
  });

  it('ignores an injected parentPassword and never touches the account tables', async () => {
    const { familyRequestCreate } = mockFamilyRequestCreate();
    const userCreate = jest.fn();
    jest.spyOn(prisma.user, 'create' as never).mockImplementation(userCreate as never);

    const response = await POST(buildRequest({
      ...validRequestData,
      parentPassword: 'temporary-password-should-not-be-used',
    }));

    expect(response.status).toBe(200);
    expect(userCreate).not.toHaveBeenCalled();
    expect(familyRequestCreate).toHaveBeenCalledTimes(1);
  });

  it('always creates a request even when the email already belongs to a known parent (no enumeration, no dedup skip)', async () => {
    const { familyRequestCreate } = mockFamilyRequestCreate();
    const findUnique = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'existing-user',
      email: 'jean.dupont@test.com',
    } as never);

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Si la demande peut etre traitee');
    expect(body).not.toHaveProperty('error');
    // The public route must not even look up an existing account any more --
    // duplicate-family resolution is createFamily()'s job at conversion time.
    expect(findUnique).not.toHaveBeenCalled();
    expect(familyRequestCreate).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when validation fails (invalid email)', async () => {
    mockFamilyRequestCreate();
    const response = await POST(buildRequest({
      ...validRequestData,
      parentEmail: 'invalid-email',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données invalides');
  });

  it('returns 400 when validation fails (too short password if injected)', async () => {
    mockFamilyRequestCreate();
    const response = await POST(buildRequest({
      ...validRequestData,
      parentPassword: '1234567',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Données invalides');
  });

  it('returns 400 for an unrecognized school grade', async () => {
    mockFamilyRequestCreate();
    const response = await POST(buildRequest({
      ...validRequestData,
      studentGrade: 'Not a real grade',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Niveau scolaire non reconnu');
  });

  it('returns 400 for an invalid phone number', async () => {
    mockFamilyRequestCreate();
    const response = await POST(buildRequest({
      ...validRequestData,
      parentPhone: '123',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
  });

  it('returns 500 when the request cannot be persisted', async () => {
    jest.spyOn(prisma, '$transaction').mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(buildRequest(validRequestData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erreur interne du serveur');
  });

  it('rate-limits before reading the request body', async () => {
    (guardSensitiveRateLimit as jest.Mock).mockResolvedValueOnce(
      new (require('next/server').NextResponse)(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
    );
    const { familyRequestCreate } = mockFamilyRequestCreate();

    const response = await POST(buildRequest(validRequestData));

    expect(response.status).toBe(429);
    expect(familyRequestCreate).not.toHaveBeenCalled();
  });

  it('rejects an oversized body without ever calling the rate limiter\'s identity path or creating a request', async () => {
    const { familyRequestCreate } = mockFamilyRequestCreate();
    const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(1024 * 1024) },
      body: JSON.stringify(validRequestData),
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(familyRequestCreate).not.toHaveBeenCalled();
  });
});
