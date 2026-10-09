/** @jest-environment node */
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => {
  const { PrismaClient } = jest.requireActual('@prisma/client');
  return { prisma: new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } }, log: [] }) };
});
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { GET } from '@/app/api/parent/subscription-requests/route';
let requesterId: string;
let otherId: string;
let studentId: string;
let ownRequestId: string;
beforeAll(async () => {
  const database = process.env.TEST_DATABASE_URL;
  if (!database) throw new Error('DISPOSABLE_DATABASE_REQUIRED');
  assertDisposablePostgresUrl(database);
  requesterId = randomUUID(); otherId = randomUUID();
  const pupilId = randomUUID();
  await prisma.user.createMany({ data: [
    { id: requesterId, role: 'PARENT' }, { id: otherId, role: 'PARENT' }, { id: pupilId, role: 'ELEVE' },
  ] });
  const family = await prisma.parentProfile.create({ data: { userId: requesterId } });
  const student = await prisma.student.create({ data: { userId: pupilId, parentId: family.id, gradeLevel: 'SECONDE' } });
  studentId = student.id;
  for (const owner of [requesterId, otherId, null]) {
    const created = await prisma.subscriptionRequest.create({ data: {
      studentId, requestedByUserId: owner, requestedBy: 'Synthetic requester',
      requestedByEmail: 'synthetic@fixture.test', requestType: 'PLAN_CHANGE',
      monthlyPrice: 100, status: 'PENDING', reason: 'Synthetic private request',
    } });
    if (owner === requesterId) ownRequestId = created.id;
  }
});
afterAll(async () => { await prisma.$disconnect(); });
it('lists only the canonical requester party; unknown history and other guardians remain private', async () => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: requesterId, role: 'PARENT' } });
  const response = await GET(new NextRequest(`http://localhost/api/parent/subscription-requests?studentId=${studentId}`));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.requests).toHaveLength(1);
  expect(body.requests[0].id).toBe(ownRequestId);
  expect(body.requests[0]).not.toHaveProperty('requestedByEmail');
  expect(body.requests[0]).not.toHaveProperty('requestedBy');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('an unrelated requester cannot gain family access merely through owning a request', async () => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: otherId, role: 'PARENT' } });
  const response = await GET(new NextRequest(`http://localhost/api/parent/subscription-requests?studentId=${studentId}`));
  expect(response.status).toBe(404);
});
it('database refuses a fabricated canonical requester', async () => {
  await expect(prisma.subscriptionRequest.create({ data: {
    studentId, requestedByUserId: randomUUID(), requestedBy: 'Synthetic',
    requestType: 'PLAN_CHANGE', monthlyPrice: 100, status: 'PENDING',
  } })).rejects.toMatchObject({ code: 'P2003' });
});
it('database preserves financial request history when its requester is deleted', async () => {
  await expect(prisma.user.delete({ where: { id: otherId } })).rejects.toMatchObject({ code: 'P2003' });
  expect(await prisma.subscriptionRequest.count({ where: { studentId } })).toBe(3);
});
