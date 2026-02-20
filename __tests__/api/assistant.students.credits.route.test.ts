import { auth } from '@/auth';
import { GET, POST } from '@/app/api/assistant/students/credits/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn(), findMany: jest.fn() },
    creditTransaction: { create: jest.fn(), findMany: jest.fn() },
  },
}));

function makeRequest(body?: any, url?: string) {
  return {
    json: async () => body,
    url: url || 'http://localhost:3000/api/assistant/students/credits',
  } as any;
}

describe('assistant students credits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 401 when not assistant', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/assistant/students/credits'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET returns student credits when studentId provided', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-1',
      grade: 'Seconde',
      school: 'Lycée',
      user: { firstName: 'Student', lastName: 'One', email: 's@test.com' },
      creditTransactions: [{ amount: 2 }, { amount: -1 }],
    });

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/assistant/students/credits?studentId=student-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.creditBalance).toBe(1);
  });

  it('GET returns list when no studentId', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.student.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'student-1',
        grade: 'Seconde',
        school: 'Lycée',
        user: { firstName: 'Student', lastName: 'One', email: 's@test.com' },
        creditTransactions: [{ amount: 2 }, { amount: -1 }],
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].creditBalance).toBe(1);
  });

  it('POST validates required fields', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing required fields');
  });

  it('POST returns 404 when student missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ studentId: 'student-1', amount: 2, type: 'CREDIT_ADD', description: 'Add' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Student not found');
  });

  it('POST creates credit transaction', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({
      id: 'tx-1',
      type: 'CREDIT_ADD',
      amount: 2,
      description: 'Add (par A S)',
      createdAt: new Date('2025-01-01'),
      student: { user: { firstName: 'Student', lastName: 'One' } },
    });
    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([{ amount: 2 }]);

    const response = await POST(makeRequest({ studentId: 'student-1', amount: '2', type: 'CREDIT_ADD', description: 'Add' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.newBalance).toBe(2);
  });
});
