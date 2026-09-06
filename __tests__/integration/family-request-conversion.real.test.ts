/**
 * Amendement 7 -- P0 family-request lifecycle against a real, isolated
 * PostgreSQL database: a public bilan-gratuit submission and a parent's
 * "add a child" action must only ever create a FamilyRequest (+ children),
 * never a User/Student directly. Only a staff (ADMIN/ASSISTANTE) conversion
 * creates the real family, exactly once, via createFamily() /
 * addChildToExistingFamily().
 *
 * No production database and no real minor identity may be used by this
 * suite.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));

import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

import { POST as registerBilan } from '@/app/api/bilan-gratuit/route';
import { POST as createChildRequest } from '@/app/api/parent/children/route';
import { POST as convertFamilyRequest } from '@/app/api/assistante/family-requests/[requestId]/convert/route';
import { auth } from '@/auth';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';

const PREFIX = 'fr-conv-' + randomUUID().slice(0, 8);
const parentEmail = `${PREFIX}-parent@example.test`;
let verified = false;

function safeTestDatabase(): void {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  assertDisposablePostgresUrl(target);
  verified = true;
}

function bilanRequest(email = parentEmail): NextRequest {
  return new NextRequest('http://localhost:3000/api/bilan-gratuit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Host: 'localhost:3000' },
    body: JSON.stringify({
      parentFirstName: PREFIX,
      parentLastName: 'Parent',
      parentEmail: email,
      parentPhone: '99000101',
      studentFirstName: PREFIX,
      studentLastName: 'Student',
      studentGrade: 'Terminale',
      studentSchool: 'Établissement de test',
      subjects: ['MATHEMATIQUES'],
      objectives: 'Vérifier uniquement le parcours technique synthétique.',
      acceptTerms: true,
    }),
  });
}

function addChildRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/parent/children', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Host: 'localhost:3000' },
    body: JSON.stringify({ firstName: PREFIX, lastName: 'SecondChild', grade: 'Seconde', school: '' }),
  });
}

function convertRequest(requestId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/assistante/family-requests/${requestId}/convert`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:3000', Host: 'localhost:3000' },
  });
}

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { contains: PREFIX } }, { lastName: { contains: PREFIX } }] },
    include: { parentProfile: { include: { children: true } } },
  });
  const parentUserIds = users.map((user) => user.id);
  const studentIds = users.flatMap((user) => user.parentProfile?.children.map((child) => child.id) ?? []);
  const childUserIds = users.flatMap((user) => user.parentProfile?.children.map((child) => child.userId) ?? []);
  const userIds = [...new Set([...parentUserIds, ...childUserIds])];

  await prisma.familyRequestChild.deleteMany({ where: { familyRequest: { contactLastName: { contains: PREFIX } } } });
  await prisma.familyRequest.deleteMany({ where: { contactLastName: { contains: PREFIX } } });
  if (userIds.length > 0) {
    await prisma.parentStudentLink.deleteMany({
      where: { OR: [{ parentUserId: { in: parentUserIds } }, { studentId: { in: studentIds } }] },
    });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.parentProfile.deleteMany({ where: { userId: { in: parentUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

describe('P0 family-request lifecycle — real PostgreSQL', () => {
  beforeAll(async () => {
    safeTestDatabase();
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    await cleanup();
  });

  afterAll(async () => {
    if (verified) await cleanup();
    await prisma.$disconnect();
  });

  it('captures a public bilan-gratuit submission as a FamilyRequest without creating any account', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await registerBilan(bilanRequest());
    expect(response.status).toBe(200);
    expect((await response.json())).toEqual(expect.objectContaining({ success: true }));

    const requests = await prisma.familyRequest.findMany({
      where: { contactEmail: parentEmail },
      include: { children: true },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual(expect.objectContaining({
      type: 'BILAN_GRATUIT',
      status: 'SUBMITTED',
      requestingParentProfileId: null,
      contactFirstName: PREFIX,
      contactLastName: 'Parent',
    }));
    expect(requests[0].children).toHaveLength(1);
    expect(requests[0].children[0]).toEqual(expect.objectContaining({
      firstName: PREFIX,
      lastName: 'Student',
      gradeLevel: 'TERMINALE',
    }));

    const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } } });
    expect(users).toHaveLength(0);
  });

  let bilanRequestId: string;
  let convertedParentUserId: string;

  it('converts the BILAN_GRATUIT request into a real family exactly once, marking it COMPLETED', async () => {
    const staff = await prisma.user.create({
      data: { role: 'ASSISTANTE', firstName: PREFIX, lastName: `${PREFIX}-Staff` },
      select: { id: true },
    });
    (auth as jest.Mock).mockResolvedValue({ user: { id: staff.id, role: 'ASSISTANTE' } });

    const pending = await prisma.familyRequest.findFirstOrThrow({ where: { contactEmail: parentEmail } });
    bilanRequestId = pending.id;

    const response = await convertFamilyRequest(convertRequest(bilanRequestId), { params: Promise.resolve({ requestId: bilanRequestId }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    convertedParentUserId = body.parentUserId;

    const updated = await prisma.familyRequest.findUniqueOrThrow({ where: { id: bilanRequestId } });
    expect(updated.status).toBe('COMPLETED');
    expect(updated.processedById).toBe(staff.id);
    expect(updated.processedAt).not.toBeNull();

    const parentUser = await prisma.user.findUnique({
      where: { id: convertedParentUserId },
      include: { parentProfile: { include: { children: { include: { user: true } } } } },
    });
    expect(parentUser?.role).toBe('PARENT');
    expect(parentUser?.email).toBe(parentEmail);
    expect(parentUser?.parentProfile?.children).toHaveLength(1);
    expect(parentUser?.parentProfile?.children[0].user.firstName).toBe(PREFIX);
  });

  it('rejects converting the same request a second time and creates no second family', async () => {
    const response = await convertFamilyRequest(convertRequest(bilanRequestId), { params: Promise.resolve({ requestId: bilanRequestId }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('FAMILY_REQUEST_ALREADY_PROCESSED');

    const parentUsers = await prisma.user.findMany({ where: { email: parentEmail } });
    expect(parentUsers).toHaveLength(1);
  });

  it('denies conversion to a non-staff role', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: convertedParentUserId, role: 'PARENT' } });

    const response = await convertFamilyRequest(convertRequest(bilanRequestId), { params: Promise.resolve({ requestId: bilanRequestId }) });

    expect(response.status).toBe(404);
  });

  it('captures a parent add-child action as an ADD_CHILD FamilyRequest, then converts it onto the same household', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: convertedParentUserId, email: parentEmail, role: 'PARENT' } });

    const response = await createChildRequest(addChildRequest());
    expect(response.status).toBe(200);
    expect((await response.json())).toEqual(expect.objectContaining({ success: true }));

    const addChildRequests = await prisma.familyRequest.findMany({
      where: { type: 'ADD_CHILD', requestingParentProfileId: { not: null } },
      include: { children: true },
      orderBy: { createdAt: 'desc' },
    });
    const ours = addChildRequests.find((request) => request.children.some((child) => child.firstName === PREFIX && child.lastName === 'SecondChild'));
    expect(ours).toBeDefined();
    expect(ours?.status).toBe('SUBMITTED');
    expect(ours?.contactEmail).toBe(parentEmail);

    const beforeStudents = await prisma.student.count({
      where: { user: { firstName: PREFIX, lastName: 'SecondChild' } },
    });
    expect(beforeStudents).toBe(0);

    const staff = await prisma.user.findFirstOrThrow({ where: { lastName: `${PREFIX}-Staff` }, select: { id: true } });
    (auth as jest.Mock).mockResolvedValue({ user: { id: staff.id, role: 'ADMIN' } });

    const convertResponse = await convertFamilyRequest(
      convertRequest(ours!.id),
      { params: Promise.resolve({ requestId: ours!.id }) },
    );
    const convertBody = await convertResponse.json();
    expect(convertResponse.status).toBe(200);
    expect(convertBody.parentUserId).toBe(convertedParentUserId);

    const afterStudents = await prisma.student.findMany({
      where: { user: { firstName: PREFIX, lastName: 'SecondChild' } },
      include: { user: true },
    });
    expect(afterStudents).toHaveLength(1);
    expect(afterStudents[0].parentId).toBeDefined();

    const parentProfile = await prisma.parentProfile.findUnique({ where: { userId: convertedParentUserId } });
    expect(afterStudents[0].parentId).toBe(parentProfile?.id);

    const finalRequest = await prisma.familyRequest.findUniqueOrThrow({ where: { id: ours!.id } });
    expect(finalRequest.status).toBe('COMPLETED');
  });
});
