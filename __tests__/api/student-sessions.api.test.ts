import { GET } from '@/app/api/student/sessions/route';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'student-user-1', role: 'ELEVE' }
  })
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'sess1',
          title: 'Cours de Maths',
          subject: 'MATHEMATIQUES',
          status: 'SCHEDULED',
          scheduledDate: new Date('2025-10-18T00:00:00Z'),
          startTime: '14:00',
          duration: 60,
          creditsUsed: 1,
          modality: 'ONLINE',
          type: 'INDIVIDUEL',
          coach: { firstName: 'Pierre', lastName: 'Martin' },
        }
      ])
    }
  }
}));

describe('GET /api/student/sessions', () => {
  it('returns mapped sessions with coach and scheduledAt Date', async () => {
    const req = new NextRequest('http://localhost/api/student/sessions');
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toMatchObject({
      id: 'sess1',
      title: 'Cours de Maths',
      subject: 'MATHEMATIQUES',
      status: 'SCHEDULED',
      duration: 60,
      creditsUsed: 1,
      modality: 'ONLINE',
    });
    expect(data[0].coach).toEqual({ firstName: 'Pierre', lastName: 'Martin' });
    expect(typeof data[0].scheduledAt).toBe('string');
    expect(new Date(data[0].scheduledAt).getHours()).toBe(14);
  });
});

