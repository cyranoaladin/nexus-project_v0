/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('server-only', () => ({}));
jest.mock('@/lib/families/student-access-authority', () => ({
  ...jest.requireActual('@/lib/families/student-access-authority'), authorizeParentStudentRecords: jest.fn(),
}));
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { authorizeParentStudentRecords } from '@/lib/families/student-access-authority';
import { GET } from '@/app/api/parent/dashboard/route';
const child = { id: 'synthetic-student', userId: 'synthetic-student-user', parent: { userId: 'synthetic-parent' },
  user: { id: 'synthetic-student-user', firstName: 'Synthetic', activatedAt: new Date('2026-10-01T00:00:00Z') },
  subscriptions: [], badges: [], totalSessions: 0, completedSessions: 0 };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT' } } as never);
  jest.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: 'synthetic-profile', children: [child] } as never);
  for (const model of [prisma.payment, prisma.parentStudentLink, prisma.progressionHistory, prisma.sessionBooking]) {
    jest.mocked(model.findMany).mockResolvedValue([] as never);
  }
});
it('omits a Core-denied child without reading private details, progression or planning', async () => {
  jest.mocked(authorizeParentStudentRecords).mockResolvedValue([{ id: child.id, status: 'DENIED' }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect((await response.json()).children).toEqual([]);
  expect(prisma.parentProfile.findUnique).toHaveBeenCalledTimes(1);
  expect(prisma.parentProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'synthetic-parent' },
    select: { id: true, children: { select: { id: true, userId: true, parent: { select: { userId: true } } } } } });
  expect(prisma.progressionHistory.findMany).not.toHaveBeenCalled();
  expect(prisma.sessionBooking.findMany).not.toHaveBeenCalled();
});
it('fails closed on authority outage before querying family data or financial history', async () => {
  jest.mocked(authorizeParentStudentRecords).mockResolvedValue([{ id: child.id, status: 'AUTHORITY_UNAVAILABLE' }]);
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(prisma.parentProfile.findUnique).toHaveBeenCalledTimes(1);
  expect(prisma.payment.findMany).not.toHaveBeenCalled();
  expect(prisma.progressionHistory.findMany).not.toHaveBeenCalled();
});
it('bounds detailed child loading by server-authorized IDs and keeps finance party-scoped', async () => {
  jest.mocked(authorizeParentStudentRecords).mockResolvedValue([{ id: child.id, status: 'CORE_VERIFIED_READ' }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect((await response.json()).children).toHaveLength(1);
  expect(authorizeParentStudentRecords).toHaveBeenCalledWith('synthetic-parent',
    expect.arrayContaining([expect.objectContaining({ id: child.id, userId: child.userId })]), 'read');
  const detailQuery = jest.mocked(prisma.parentProfile.findUnique).mock.calls[1]?.[0];
  expect(detailQuery?.include?.children).toEqual(expect.objectContaining({ where: { id: { in: [child.id] } } }));
  expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'synthetic-parent' } }));
});
