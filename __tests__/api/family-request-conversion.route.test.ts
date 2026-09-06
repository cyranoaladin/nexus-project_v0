import { NextRequest } from 'next/server';
import { POST } from '@/app/api/assistante/family-requests/[requestId]/convert/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import * as createFamilyModule from '@/lib/families/create-family';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

jest.mock('@/lib/families/create-family', () => ({
  createFamily: jest.fn(),
  addChildToExistingFamily: jest.fn(),
}));

function makeRequest() {
  return new NextRequest('http://localhost/api/assistante/family-requests/fr-1/convert', { method: 'POST' });
}

function paramsFor(requestId: string) {
  return { params: Promise.resolve({ requestId }) };
}

describe('POST /api/assistante/family-requests/[requestId]/convert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 for a non-staff caller', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });

    const response = await POST(makeRequest(), paramsFor('fr-1'));

    expect(response.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest(), paramsFor('fr-1'));

    expect(response.status).toBe(401);
  });

  it('returns 404 when the request does not exist', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
      familyRequest: { findUnique: jest.fn().mockResolvedValue(null) },
    }));

    const response = await POST(makeRequest(), paramsFor('missing'));

    expect(response.status).toBe(404);
  });

  it('rejects converting an already COMPLETED request', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
      familyRequest: {
        findUnique: jest.fn().mockResolvedValue({ id: 'fr-1', status: 'COMPLETED', type: 'BILAN_GRATUIT', children: [] }),
        updateMany: jest.fn(),
      },
    }));

    const response = await POST(makeRequest(), paramsFor('fr-1'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('FAMILY_REQUEST_ALREADY_PROCESSED');
  });

  it('converts a BILAN_GRATUIT request via createFamily() and marks it COMPLETED', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const familyRequest = {
      id: 'fr-1',
      status: 'SUBMITTED',
      type: 'BILAN_GRATUIT',
      requestingParentProfileId: null,
      contactFirstName: 'Jean',
      contactLastName: 'Dupont',
      contactEmail: 'jean@test.com',
      contactPhone: '99000001',
      contactPhoneNormalized: '99000001',
      children: [{ id: 'c1', firstName: 'Marie', lastName: 'Dupont', gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', schoolingStatus: null, school: null }],
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
      familyRequest: {
        findUnique: jest.fn().mockResolvedValue(familyRequest),
        updateMany,
      },
    }));
    (createFamilyModule.createFamily as jest.Mock).mockResolvedValue({
      parentUserId: 'parent-user-1',
      parentCreated: true,
      children: [{ studentId: 'student-1', firstName: 'Marie', gradeLevel: 'TERMINALE' }],
    });

    const response = await POST(makeRequest(), paramsFor('fr-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.parentUserId).toBe('parent-user-1');
    expect(body.studentIds).toEqual(['student-1']);
    expect(createFamilyModule.createFamily).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'fr-1', status: 'SUBMITTED' },
      data: expect.objectContaining({ status: 'COMPLETED', processedById: 'staff-1' }),
    }));
  });

  it('converts an ADD_CHILD request via addChildToExistingFamily()', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const familyRequest = {
      id: 'fr-2',
      status: 'SUBMITTED',
      type: 'ADD_CHILD',
      requestingParentProfileId: 'parent-profile-1',
      contactFirstName: 'Parent',
      contactLastName: 'Existant',
      contactEmail: 'parent@test.com',
      contactPhone: '99000002',
      contactPhoneNormalized: '99000002',
      children: [{ id: 'c2', firstName: 'Ali', lastName: 'Existant', gradeLevel: 'SECONDE', academicTrack: null, schoolingStatus: null, school: null }],
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
      familyRequest: {
        findUnique: jest.fn().mockResolvedValue(familyRequest),
        updateMany,
      },
      parentProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'parent-profile-1', userId: 'parent-user-1', user: { email: 'parent@test.com' } }),
      },
    }));
    (createFamilyModule.addChildToExistingFamily as jest.Mock).mockResolvedValue({ studentId: 'student-2' });

    const response = await POST(makeRequest(), paramsFor('fr-2'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.parentUserId).toBe('parent-user-1');
    expect(body.studentIds).toEqual(['student-2']);
    expect(createFamilyModule.addChildToExistingFamily).toHaveBeenCalledTimes(1);
    expect(createFamilyModule.createFamily).not.toHaveBeenCalled();
  });

  it('rejects a replayed conversion without creating a second family', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
      familyRequest: {
        findUnique: jest.fn().mockResolvedValue({ id: 'fr-1', status: 'SUBMITTED', type: 'BILAN_GRATUIT', children: [] }),
        updateMany,
      },
    }));

    const response = await POST(makeRequest(), paramsFor('fr-1'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('FAMILY_REQUEST_ALREADY_PROCESSED');
    expect(createFamilyModule.createFamily).not.toHaveBeenCalled();
  });
});
