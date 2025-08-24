import { GET } from '@/app/api/coach/dashboard/route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));

describe('API /api/coach/dashboard', () => {
  it('rejette sans session COACH', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);
    // @ts-ignore
    const res = await GET(new NextRequest('http://localhost/api/coach/dashboard'));
    expect(res.status).toBe(401);
  });
});


