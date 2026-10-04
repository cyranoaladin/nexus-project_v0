/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('server-only', () => ({}));
jest.mock('@/lib/families/student-access-authority', () => ({
  ...jest.requireActual('@/lib/families/student-access-authority'), authorizeParentStudentRecords: jest.fn(),
}));
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { authorizeParentStudentRecords } from '@/lib/families/student-access-authority';
import { GET as childrenGet } from '@/app/api/parent/children/route';
import { GET as subscriptionsGet } from '@/app/api/parent/subscriptions/route';
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT' } } as never);
  jest.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: 'synthetic-parent-profile' } as never);
  jest.mocked(prisma.student.findMany).mockResolvedValue([{ id: 'synthetic-student', userId: 'synthetic-student-user',
    parent: { userId: 'synthetic-parent' }, user: { firstName: 'Synthetic', lastName: 'Fixture', email: 'synthetic@fixture.test' },
    sessions: [], subscriptions: [], createdAt: new Date('2026-10-04T00:00:00Z') }] as never);
});
describe.each([{ name: 'children', handler: childrenGet }, { name: 'subscriptions', handler: subscriptionsGet }])('$name family authority', ({ name, handler }) => {
  const invoke = () => handler(new NextRequest('https://nexusreussite.academy/api/parent/'+name));
  it('omits denied Core families without loading names, planning or subscriptions', async () => {
    jest.mocked(authorizeParentStudentRecords).mockResolvedValue([{ id: 'synthetic-student', status: 'DENIED' }]);
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual(name === 'children' ? [] : { children: [] });
    expect(prisma.student.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.student.findMany).toHaveBeenCalledWith({ where: { parentId: 'synthetic-parent-profile' },
      select: { id: true, userId: true, parent: { select: { userId: true } } } });
  });
  it('fails closed on a Core authority outage before loading private details', async () => {
    jest.mocked(authorizeParentStudentRecords).mockResolvedValue([{ id: 'synthetic-student', status: 'AUTHORITY_UNAVAILABLE' }]);
    expect((await invoke()).status).toBe(503);
    expect(prisma.student.findMany).toHaveBeenCalledTimes(1);
  });
  it('filters the private data query by the server-authorized student IDs', async () => {
    jest.mocked(authorizeParentStudentRecords).mockResolvedValue([{ id: 'synthetic-student', status: 'CORE_VERIFIED_READ' }]);
    expect((await invoke()).status).toBe(200);
    expect(authorizeParentStudentRecords).toHaveBeenCalledWith('synthetic-parent',
      expect.arrayContaining([expect.objectContaining({ id: 'synthetic-student', userId: 'synthetic-student-user' })]), 'read');
    expect(jest.mocked(prisma.student.findMany).mock.calls[1]?.[0]?.where).toEqual({
      parentId: 'synthetic-parent-profile', id: { in: ['synthetic-student'] },
    });
  });
});
