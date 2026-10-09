import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { GET as subscriptions } from '@/app/api/parent/subscriptions/route';
import { GET as dashboard } from '@/app/api/parent/dashboard/route';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
const child = { id: 'synthetic-child', userId: 'synthetic-student-user', parent: { userId: 'synthetic-parent' }, grade: 'Synthetic grade', school: 'Synthetic school',
  gradeLevel: 'SECONDE', academicTrack: 'EDS_GENERALE', totalSessions: 0, completedSessions: 0, badges: [],
  user: { id: 'synthetic-student-user', firstName: 'Synthetic', lastName: 'Fixture', activatedAt: new Date(), activationExpiry: null },
  subscriptions: [{ id: 'synthetic-subscription', planName: 'Synthetic plan', status: 'ACTIVE',
    monthlyPrice: 424242, ariaCost: 999, startDate: new Date('2026-10-01T00:00:00Z'), endDate: null }],
};
beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT' } });
  (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'synthetic-family', children: [child] });
  (prisma.student.findMany as jest.Mock).mockResolvedValue([child]);
  for (const model of [prisma.payment, prisma.parentStudentLink, prisma.progressionHistory, prisma.sessionBooking]) {
    (model.findMany as jest.Mock).mockResolvedValue([]);
  }
});
it('subscription family view retains pedagogical service state without private prices', async () => {
  const response = await subscriptions(new NextRequest('http://localhost/api/parent/subscriptions'));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.children[0].subscriptionDetails.planName).toBe('Synthetic plan');
  expect(body.children[0].subscriptionDetails).not.toHaveProperty('monthlyPrice');
  expect(body.children[0].subscriptionDetails).not.toHaveProperty('ariaCost');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const identityQuery = (prisma.student.findMany as jest.Mock).mock.calls[0][0];
  expect(identityQuery.select).toEqual({ id: true, userId: true, parent: { select: { userId: true } } });
  const query = (prisma.student.findMany as jest.Mock).mock.calls[1][0];
  expect(query.where).toEqual({ parentId: 'synthetic-family', id: { in: ['synthetic-child'] } });
  expect(query.include.subscriptions.select).not.toHaveProperty('monthlyPrice');
  expect(query.include.subscriptions.select).not.toHaveProperty('ariaCost');
});
it('parent dashboard does not derive finance visibility from child membership', async () => {
  const response = await dashboard();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.children[0].subscription).toBe('Synthetic plan');
  expect(body.children[0].subscriptionDetails).not.toHaveProperty('monthlyPrice');
  expect(body.children[0].subscriptionDetails).not.toHaveProperty('ariaCost');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const identityQuery = (prisma.parentProfile.findUnique as jest.Mock).mock.calls[0][0];
  expect(identityQuery.select.children.select).toEqual({ id: true, userId: true, parent: { select: { userId: true } } });
  const query = (prisma.parentProfile.findUnique as jest.Mock).mock.calls[1][0];
  expect(query.include.children.where).toEqual({ id: { in: ['synthetic-child'] } });
  expect(query.include.children.include.subscriptions.select).not.toHaveProperty('monthlyPrice');
  expect(query.include.children.include.subscriptions.select).not.toHaveProperty('ariaCost');
  expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'synthetic-parent' } }));
});
it.each(['dashboard', 'subscriptions'])('family %s refuses a session without canonical user identity before querying', async route => {
  (auth as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } });
  const response = route === 'dashboard' ? await dashboard()
    : await subscriptions(new NextRequest('http://localhost/api/parent/subscriptions'));
  expect(response.status).toBe(401);
  expect(prisma.parentProfile.findUnique).not.toHaveBeenCalled();
  expect(prisma.student.findMany).not.toHaveBeenCalled();
});
it.each(['dashboard', 'subscriptions'])('family %s read errors never serialize private exception data', async route => {
  (prisma.parentProfile.findUnique as jest.Mock).mockRejectedValueOnce(new Error('SYNTHETIC_PRIVATE_SUBSCRIPTION_CANARY'));
  const logging = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = route === 'dashboard' ? await dashboard()
      : await subscriptions(new NextRequest('http://localhost/api/parent/subscriptions'));
    expect(response.status).toBe(500);
    expect(logging).toHaveBeenCalledWith(route === 'dashboard' ? 'PARENT_DASHBOARD_READ_FAILED' : 'PARENT_SUBSCRIPTIONS_READ_FAILED');
    expect(JSON.stringify(logging.mock.calls)).not.toContain('SYNTHETIC_PRIVATE_SUBSCRIPTION_CANARY');
    expect(JSON.stringify(await response.json())).not.toContain('SYNTHETIC_PRIVATE_SUBSCRIPTION_CANARY');
  } finally { logging.mockRestore(); }
});
