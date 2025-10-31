import { GET } from '@/app/api/sessions/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      findMany: jest.fn(),
    },
  },
}));

const mockSession = {
  id: 's1',
  title: 'Cours Maths',
  subject: 'MATHEMATIQUES',
  scheduledDate: new Date('2025-10-20T00:00:00Z'),
  startTime: '14:00',
  endTime: '15:00',
  duration: 60,
  status: 'SCHEDULED',
  type: 'INDIVIDUAL',
  modality: 'ONLINE',
  creditsUsed: 1,
  studentId: 'stu1',
  coachId: 'coach1',
  parentId: 'par1',
  createdAt: new Date('2025-10-01T10:00:00Z'),
  student: { id: 'stu1', firstName: 'Marie', lastName: 'Dupont' },
  coach: { id: 'coach1', firstName: 'Pierre', lastName: 'Martin' },
  parent: { id: 'par1', firstName: 'Jean', lastName: 'Dupont' },
};

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedFindMany = prisma.sessionBooking.findMany as jest.Mock;

describe('GET /api/sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    mockedFindMany.mockResolvedValue([mockSession]);
  });

  it('returns formatted sessions for assistant role', async () => {
    const req = new NextRequest('http://localhost/api/sessions?role=assistant');
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions[0]).toMatchObject({
      id: 's1',
      title: 'Cours Maths',
      subject: 'MATHEMATIQUES',
      startTime: '14:00',
      endTime: '15:00',
      duration: 60,
      status: 'SCHEDULED',
      type: 'INDIVIDUAL',
      modality: 'ONLINE',
    });
    expect(data.sessions[0].student).toEqual({ id: 'stu1', firstName: 'Marie', lastName: 'Dupont' });
    expect(data.sessions[0].coach).toEqual({ id: 'coach1', firstName: 'Pierre', lastName: 'Martin' });
  });

  it('rejects invalid status parameter', async () => {
    const req = new NextRequest('http://localhost/api/sessions?status=UNKNOWN');
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Invalid query parameters');
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it('rejects invalid date format', async () => {
    const req = new NextRequest('http://localhost/api/sessions?startDate=10-25-2025');
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Invalid query parameters');
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it('rejects range where endDate precedes startDate', async () => {
    const req = new NextRequest('http://localhost/api/sessions?startDate=2025-10-20&endDate=2025-10-01');
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Invalid query parameters');
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it('applies date filters when provided', async () => {
    const req = new NextRequest('http://localhost/api/sessions?startDate=2025-10-01&endDate=2025-10-31');
    await GET(req as any);

    expect(mockedFindMany).toHaveBeenCalledTimes(1);
    const args = mockedFindMany.mock.calls[0][0];
    expect(args.include).toBeDefined();
    expect(args.where.scheduledDate).toMatchObject({
      gte: new Date('2025-10-01'),
      lte: new Date('2025-10-31'),
    });
  });
});

