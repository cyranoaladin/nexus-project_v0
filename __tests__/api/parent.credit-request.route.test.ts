import { POST } from '@/app/api/parent/credit-request/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentProfile: { findUnique: jest.fn() },
    student: { findFirst: jest.fn() },
    creditTransaction: { create: jest.fn() },
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/parent/credit-request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not parent', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 on missing fields', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One' },
    });

    const response = await POST(makeRequest({ studentId: 'student-1' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing required fields');
  });

  it('returns 404 when parent profile missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ studentId: 'student-1', creditAmount: 2 }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Parent profile not found');
  });

  it('returns 404 when student not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ studentId: 'student-1', creditAmount: 2 }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Student not found or unauthorized');
  });

  it('creates credit request', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1', user: {} });
    (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({ id: 'credit-req-1' });

    const response = await POST(
      makeRequest({ studentId: 'student-1', creditAmount: 2, reason: 'Need credits' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.requestId).toBe('credit-req-1');
  });
});
