import { GET, PATCH } from '@/app/api/assistant/subscription-requests/route';
import { NextRequest } from 'next/server';

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();
const mockStudentUpdate = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'Cléa', lastName: 'Assist' }
  })
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptionRequest: {
      findMany: (...args: any[]) => mockFindMany(...args),
      count: (...args: any[]) => mockCount(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    subscription: {
      updateMany: (...args: any[]) => mockUpdateMany(...args)
    },
    student: {
      update: (...args: any[]) => mockStudentUpdate(...args)
    }
  }
}));

describe('Assistant Subscription Requests API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns requests', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'sr1', createdAt: new Date(), monthlyPrice: 99, planName: 'HYBRIDE', studentId: 'st1', student: { user: { firstName: 'Marie', lastName: 'Dupont', email: 'p@x.tn' } } }]);
    mockCount.mockResolvedValueOnce(1);

    const req = new NextRequest('http://localhost/api/assistant/subscription-requests?status=PENDING&page=1&limit=20');
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
  });

  it('PATCH approves a plan change and updates subscription', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'sr1', status: 'PENDING', requestType: 'PLAN_CHANGE', studentId: 'st1', planName: 'HYBRIDE', monthlyPrice: 99 });

    // Ensure subscription.create exists in mock
    const mockCreate = jest.fn();
    (jest.requireMock('@/lib/prisma') as any).prisma.subscription.create = (...args: any[]) => mockCreate(...args);

    const req = new NextRequest('http://localhost/api/assistant/subscription-requests', {
      method: 'PATCH',
      body: JSON.stringify({ requestId: 'sr1', action: 'APPROVED' })
    } as any);
    const res = await PATCH(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdateMany).toHaveBeenCalled();
  });
});

