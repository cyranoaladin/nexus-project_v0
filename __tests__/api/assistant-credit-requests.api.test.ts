import { GET, POST } from '@/app/api/assistant/credit-requests/route';
import { NextRequest } from 'next/server';

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockTx = { creditTransaction: { update: mockUpdate, create: mockCreate } } as any;

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'Cléa', lastName: 'Assist' }
  })
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    creditTransaction: {
      findMany: (...args: any[]) => mockFindMany(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
      create: (...args: any[]) => mockCreate(...args),
    },
    $transaction: (fn: any) => fn(mockTx),
  }
}));

describe('Assistant Credit Requests API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns formatted credit requests', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'cr1', amount: 10, description: 'Demande', createdAt: new Date(),
        student: { id: 'stu1', user: { firstName: 'Marie', lastName: 'Dupont' }, grade: 'Terminale', school: 'Lycée', parent: { user: { firstName: 'Jean', lastName: 'Dupont', email: 'p@x.tn' } } }
      }
    ]);

    const req = new NextRequest('http://localhost/api/assistant/credit-requests');
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].id).toBe('cr1');
    expect(data[0].student.firstName).toBe('Marie');
  });

  it('POST approve updates and adds credits', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'cr1', type: 'CREDIT_REQUEST', studentId: 'stu1', amount: 15 });

    const req = new NextRequest('http://localhost/api/assistant/credit-requests', {
      method: 'POST',
      body: JSON.stringify({ requestId: 'cr1', action: 'approve', reason: 'ok' })
    } as any);
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
  });
});

