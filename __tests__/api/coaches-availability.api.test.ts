import { GET } from '@/app/api/coaches/availability/route';
import { NextRequest } from 'next/server';

// Mock next-auth/next to avoid request scope error
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'coach-1', role: 'COACH' }
  })
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachAvailability: {
      findMany: jest.fn().mockResolvedValue([
        { dayOfWeek: 1, startTime: '09:00', endTime: '10:00', isRecurring: true, specificDate: null, coach: { id: 'coach-1', firstName: 'Pierre', lastName: 'Martin', email: 'p@x.tn' } }
      ])
    },
    sessionBooking: {
      findMany: jest.fn().mockResolvedValue([])
    }
  }
}));

describe('GET /api/coaches/availability', () => {
  it('returns availability and available slots for date range', async () => {
    const req = new NextRequest('http://localhost/api/coaches/availability?startDate=2025-10-20&endDate=2025-10-21');
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.availability)).toBe(true);
    expect(Array.isArray(data.availableSlots)).toBe(true);
  });
});
