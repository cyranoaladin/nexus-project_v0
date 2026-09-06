import { GET } from '@/app/api/assistante/students/[studentId]/route';
import { prisma } from '@/lib/prisma';
import { requireAnyRole } from '@/lib/guards';
jest.mock('@/lib/whatsapp/invitation-status', () => ({ getLatestParentWhatsAppInvitationStatus: jest.fn().mockResolvedValue({ status: 'PENDING', queuedAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z' }) }));
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: (value: Response) => value instanceof Response }));
jest.mock('@/lib/rbac', () => ({ can: jest.fn().mockReturnValue(true) }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  student: { findUnique: jest.fn().mockResolvedValue({ id: 's1', parent: { user: { id: 'parent-1' } } }) },
  coachStudentAssignment: { findMany: jest.fn().mockResolvedValue([]) },
  creditTransaction: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 8 } }), findMany: jest.fn().mockResolvedValue([]) },
} }));
it('provides profile and assignments without querying legacy credits', async () => {
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE' } });
  const response = await GET(new Request('http://localhost/'), { params: Promise.resolve({ studentId: 's1' }) });
  expect(await response.json()).toMatchObject({ success: true, student: { id: 's1' }, assignments: [], parentInvitation: { status: 'PENDING' } });
  expect(prisma.creditTransaction.aggregate).not.toHaveBeenCalled();
  expect(prisma.creditTransaction.findMany).not.toHaveBeenCalled();
});
it('exposes the current manual delivery mode after staff authorization', async () => {
 const previous = process.env.WHATSAPP_SEND_ENABLED;
 delete process.env.WHATSAPP_SEND_ENABLED;
 try {
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE' } });
  const response = await GET(new Request('http://localhost/'), { params: Promise.resolve({ studentId: 's1' }) });
  expect(await response.json()).toMatchObject({ invitationMode: 'MANUAL', student: { parent: { user: { id: 'parent-1' } } } });
 } finally { if (previous === undefined) delete process.env.WHATSAPP_SEND_ENABLED; else process.env.WHATSAPP_SEND_ENABLED = previous; }
});
