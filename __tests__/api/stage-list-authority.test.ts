/** @jest-environment node */
jest.mock('@/lib/guards', () => ({ requireRole: jest.fn() }));
jest.mock('@/lib/families/list-access-authority', () => ({ resolveParentStudentListAccess: jest.fn() }));
import { GET as studentGet } from '@/app/api/student/stages/route';
import { GET as parentGet } from '@/app/api/parent/stages/route';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { resolveParentStudentListAccess } from '@/lib/families/list-access-authority';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireRole).mockResolvedValue({ user: { id: 'synthetic-user', role: 'ELEVE', email: 'same@synthetic.test' } } as never);
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ id: 'synthetic-student' } as never);
  jest.mocked(prisma.student.findFirst).mockResolvedValue({ id: 'synthetic-student' } as never);
  jest.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: 'synthetic-parent-profile', children: [] } as never);
  jest.mocked(prisma.stageReservation.findMany).mockResolvedValue([]);
  jest.mocked(prisma.stageBilan.findMany).mockResolvedValue([]);
  jest.mocked(prisma.bilan.findMany).mockResolvedValue([]);
  jest.mocked(prisma.parentStudentLink.findMany).mockResolvedValue([]);
  jest.mocked(resolveParentStudentListAccess).mockResolvedValue({ studentIds: ['synthetic-student'], unavailable: false });
});

test('student reservations use canonical identity, never the shared or changed email', async () => {
  const response = await studentGet();
  expect(response.status).toBe(200);
  expect(prisma.student.findUnique).toHaveBeenCalledWith({ where: { userId: 'synthetic-user' }, select: { id: true } });
  expect(jest.mocked(prisma.stageReservation.findMany).mock.calls[0][0]?.where).toEqual({ studentId: 'synthetic-student', richStatus: 'CONFIRMED' });
  expect(prisma.student.findFirst).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toContain('no-store');
});
test('missing student profile prevents all reservation and report reads', async () => {
  jest.mocked(prisma.student.findUnique).mockResolvedValue(null);
  expect((await studentGet()).status).toBe(404);
  expect(prisma.stageReservation.findMany).not.toHaveBeenCalled();
  expect(prisma.stageBilan.findMany).not.toHaveBeenCalled();
  expect(prisma.bilan.findMany).not.toHaveBeenCalled();
});
test.each([studentGet, parentGet])('stage listing selects pedagogy without finance or activation credentials', async handler => {
  expect((await handler()).status).toBe(200);
  const query = jest.mocked(prisma.stageReservation.findMany).mock.calls[0][0];
  expect(query?.include).toBeUndefined();
  expect(query?.select).toEqual(expect.objectContaining({ id: true, stage: expect.any(Object) }));
  for (const field of ['price', 'paymentRef', 'paymentMethod', 'paymentStatus', 'activationToken', 'email', 'phone', 'notes']) {
    expect(query?.select).not.toHaveProperty(field);
  }
  expect(query?.select?.stage).toEqual(expect.objectContaining({ select: expect.not.objectContaining({ priceAmount: true }) }));
});
test.each([
  { studentIds: [], unavailable: false, status: 200 },
  { studentIds: [], unavailable: true, status: 503 },
])('parent family refusal/outage blocks pedagogical data reads ($status)', async access => {
  jest.mocked(resolveParentStudentListAccess).mockResolvedValue(access);
  const response = await parentGet();
  expect(response.status).toBe(access.status);
  expect(resolveParentStudentListAccess).toHaveBeenCalledWith('synthetic-user', 'synthetic-parent-profile');
  expect(prisma.stageReservation.findMany).not.toHaveBeenCalled();
  expect(prisma.stageBilan.findMany).not.toHaveBeenCalled();
  expect(prisma.bilan.findMany).not.toHaveBeenCalled();
});
test('parent reservations and legacy reports are filtered by authorized students before reading', async () => {
  const response = await parentGet();
  expect(response.status).toBe(200);
  expect(jest.mocked(prisma.stageReservation.findMany).mock.calls[0][0]?.where).toEqual({ studentId: { in: ['synthetic-student'] }, richStatus: 'CONFIRMED' });
  expect(jest.mocked(prisma.stageBilan.findMany).mock.calls[0][0]?.where).toEqual({ studentId: { in: ['synthetic-student'] }, isPublished: true });
  expect(prisma.parentProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'synthetic-user' }, select: { id: true } });
  expect(response.headers.get('cache-control')).toContain('no-store');
});
