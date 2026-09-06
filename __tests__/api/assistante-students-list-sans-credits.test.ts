import { GET } from '@/app/api/assistante/students/route';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: (value: Response) => value instanceof Response }));
jest.mock('@/lib/rbac', () => ({ can: jest.fn().mockReturnValue(true) }));
jest.mock('@/lib/prisma', () => ({ prisma: { student: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(1) } } }));
it('publishes admissions without their legacy credit allocation', async () => {
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE' } });
  (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 's1', subscriptions: [{ id: 'sub1', status: 'ACTIVE', monthlyPrice: 300, creditsPerMonth: 8 }] }]);
  const response = await GET(new Request('http://localhost/api/assistante/students'));
  const data = await response.json();
  expect(data.students[0].subscriptions).toEqual([{ id: 'sub1', status: 'ACTIVE', monthlyPrice: 300 }]);
  expect(data.pagination.total).toBe(1);
});

it('searches the school as well as the student identity', async () => {
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE' } });
  (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
  await GET(new Request('http://localhost/api/assistante/students?search=Lycee'));
  expect(prisma.student.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([{ school: { contains: 'Lycee', mode: 'insensitive' } }]) }) }));
});
