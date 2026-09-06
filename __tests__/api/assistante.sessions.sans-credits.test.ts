import { POST } from '@/app/api/assistante/sessions/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));
const studentId = 'clh1234567890abcdefghij';
const coachId = 'clh1234567890abcdefghik';
const body = { studentId, coachId, subject: 'MATHEMATIQUES', scheduledDate: '2026-10-20', startTime: '10:00', endTime: '11:00', duration: 60, title: 'Mathématiques', creditsUsed: 5 };
const request = { json: async () => body } as any;
describe('Assistant scheduling without credits', () => {
  let tx: any;
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE', id: 'staff' } });
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    tx = {
      user: { findUnique: jest.fn(({ where }) => ({ id: where.id, role: where.id === coachId ? 'COACH' : 'ELEVE' })) },
      student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-profile', parent: { userId: 'parent' } }) },
      coachProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-profile', subjects: '["MATHEMATIQUES"]' }) },
      sessionBooking: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'booking', scheduledDate: new Date('2026-10-20'), startTime: '10:00', endTime: '11:00' }) },
      stageSession: { findFirst: jest.fn().mockResolvedValue(null) },
      coachAvailability: { findFirst: jest.fn().mockResolvedValue({ id: 'availability' }) },
      creditTransaction: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(callback => callback(tx));
  });
  it('books an available session with no balance despite a legacy credit payload', async () => {
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(tx.sessionBooking.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ creditsUsed: 0, parentId: 'parent' }) }));
    expect(tx.creditTransaction.findMany).not.toHaveBeenCalled();
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
  });
  it('still blocks scheduling conflicts', async () => {
    tx.sessionBooking.findFirst.mockResolvedValueOnce({ id: 'conflict' });
    expect((await POST(request)).status).toBe(409);
    expect(tx.sessionBooking.create).not.toHaveBeenCalled();
  });
  it('still checks coach availability', async () => {
    tx.coachAvailability.findFirst.mockResolvedValue(null);
    expect((await POST(request)).status).toBe(400);
    expect(tx.sessionBooking.create).not.toHaveBeenCalled();
  });
});
