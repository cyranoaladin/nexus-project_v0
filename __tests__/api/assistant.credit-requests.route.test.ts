import { GET, POST } from '@/app/api/assistant/credit-requests/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    creditTransaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('assistant credit-requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 401 when not assistant', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET returns formatted credit requests', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'req-1',
        amount: 2,
        description: 'desc',
        createdAt: new Date('2025-01-01'),
        student: {
          id: 'student-1',
          grade: 'Seconde',
          school: 'Lycée',
          user: { firstName: 'Student', lastName: 'One' },
          parent: { user: { firstName: 'Parent', lastName: 'One', email: 'p@test.com' } },
        },
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.creditRequests).toHaveLength(1);
  });

  it('POST validates required fields', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing required fields');
  });

  it('POST approves credit request', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.creditTransaction.findUnique as jest.Mock).mockResolvedValue({
      id: 'req-1',
      type: 'CREDIT_REQUEST',
      amount: 2,
      studentId: 'student-1',
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        creditTransaction: {
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        },
      };
      return cb(tx);
    });

    const response = await POST(makeRequest({ requestId: 'req-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('POST rejects credit request', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.creditTransaction.findUnique as jest.Mock).mockResolvedValue({
      id: 'req-1',
      type: 'CREDIT_REQUEST',
      amount: 2,
      studentId: 'student-1',
    });
    (prisma.creditTransaction.update as jest.Mock).mockResolvedValue({});

    const response = await POST(makeRequest({ requestId: 'req-1', action: 'reject' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
