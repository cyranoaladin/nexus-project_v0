import { PATCH } from '@/app/api/sessions/[id]/status/route';
import { NextRequest } from 'next/server';

const mockUpdate = jest.fn().mockResolvedValue({ id: 's1', status: 'COMPLETED' });

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'assistant-1', role: 'ASSISTANTE' }
  })
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      update: (...args: any[]) => mockUpdate(...args)
    }
  }
}));

describe('PATCH /api/sessions/[id]/status', () => {
  it('updates session status when role is assistant', async () => {
    const req = new NextRequest('http://localhost/api/sessions/s1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED', notes: 'OK' })
    } as any);
    const res = await PATCH(req as any, { params: { id: 's1' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.session).toEqual({ id: 's1', status: 'COMPLETED' });
    expect(mockUpdate).toHaveBeenCalled();
  });
});

