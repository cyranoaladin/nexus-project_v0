jest.mock('@/lib/guards', () => ({ requireRole: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { stageReservation: { findMany: jest.fn() } } }));
import { GET } from '@/app/api/student/stages/route';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
it('fails closed for a student session without the identifier required by the legacy stage lookup', async () => {
  (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'student-1', role: 'ELEVE', email: null } });
  expect((await GET()).status).toBe(401);
  expect(prisma.stageReservation.findMany).not.toHaveBeenCalled();
});
