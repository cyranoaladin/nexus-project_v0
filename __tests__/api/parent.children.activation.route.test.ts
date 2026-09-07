/**
 * Amendement 7 (core-family-academic-planning, Task 4): POST
 * /api/parent/children no longer creates a child account directly -- P0-03's
 * "stays inactive with its own activation token" invariant is superseded by
 * a stronger one: no `User`/`Student` row is created by this route at all.
 * It only records an ADD_CHILD FamilyRequest; the activation token is minted
 * later, by staff conversion (addChildToExistingFamily(), covered in
 * __tests__/api/family-request-conversion.route.test.ts and
 * __tests__/integration/family-request-conversion.real.test.ts).
 */

import { POST as createChild } from '@/app/api/parent/children/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';

jest.mock('@/auth');
jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'email-job-1' }),
}));
jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

import { enqueueEmailIntent } from '@/lib/email/outbox';
const mockEnqueueEmailIntent = enqueueEmailIntent as jest.Mock;

function mockParentSession(userId = 'parent-1') {
  (auth as jest.Mock).mockResolvedValue({
    user: { id: userId, role: 'PARENT', email: 'parent@example.com' },
  });
}

function req(body: object) {
  return new NextRequest('http://localhost/api/parent/children', {
    method: 'POST',
    headers: { 'content-length': String(Buffer.byteLength(JSON.stringify(body))) },
    body: JSON.stringify(body),
  });
}

function mockFamilyRequestTransaction() {
  const familyRequestCreate = jest.fn().mockResolvedValue({ id: 'family-request-1' });
  (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
    familyRequest: { create: familyRequestCreate },
  }));
  return familyRequestCreate;
}

describe('POST /api/parent/children — Amendement 7 (request-only, no account)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    mockParentSession();
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'parent-profile-1',
      user: { firstName: 'Parent', lastName: 'Example', email: 'parent@example.com', phone: '99000001', phoneNormalized: '99000001' },
    });
  });

  it('creates zero User/Student rows and never mints an activation token', async () => {
    const familyRequestCreate = mockFamilyRequestTransaction();
    const userCreate = jest.fn();
    const studentCreate = jest.fn();
    (prisma.user.create as jest.Mock) = userCreate;
    (prisma.student.create as jest.Mock) = studentCreate;

    const response = await createChild(req({
      firstName: 'Jean',
      lastName: 'Dupont',
      grade: 'Terminale',
      school: 'Lycée',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json).not.toHaveProperty('activation');
    expect(JSON.stringify(json)).not.toContain('activationToken');
    expect(JSON.stringify(json)).not.toContain('tokenHash');
    expect(userCreate).not.toHaveBeenCalled();
    expect(studentCreate).not.toHaveBeenCalled();
    expect(mockEnqueueEmailIntent).not.toHaveBeenCalled();

    expect(familyRequestCreate).toHaveBeenCalledTimes(1);
    expect(familyRequestCreate.mock.calls[0][0].data).toEqual(expect.objectContaining({
      type: 'ADD_CHILD',
      requestingParentProfileId: 'parent-profile-1',
    }));
  });

  it('returns 401 for non-parent', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    const response = await createChild(req({ firstName: 'A', lastName: 'B', grade: 'Seconde' }));
    expect(response.status).toBe(401);
  });

  it('never sends any email from this route -- delivery only happens after staff conversion', async () => {
    mockFamilyRequestTransaction();

    const response = await createChild(req({ firstName: 'Marie', lastName: 'Curie', grade: 'Première' }));

    expect(response.status).toBe(200);
    expect(mockEnqueueEmailIntent).not.toHaveBeenCalled();
  });
});
