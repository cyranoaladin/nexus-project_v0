import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/parent/subscriptions/route';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
it('rejects a suspended subscription sale before ownership queries or side effects', async () => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT' } });
  const response = await POST(new NextRequest('https://nexusreussite.academy/api/parent/subscriptions', {
    method: 'POST', body: JSON.stringify({ studentId: 'synthetic-student', planName: 'HYBRIDE' }),
  }));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'SALE_SUSPENDED' });
  expect(prisma.parentProfile.findUnique).not.toHaveBeenCalled();
  expect(prisma.subscriptionRequest.create).not.toHaveBeenCalled();
  expect(prisma.notification.create).not.toHaveBeenCalled();
});
