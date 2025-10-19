import { GET } from '@/app/api/sessions/route';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'assistant-1', role: 'ASSISTANTE' }
  })
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      findMany: jest.fn().mockResolvedValue([
        {
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
          student: { firstName: 'Marie', lastName: 'Dupont' },
          coach: { firstName: 'Pierre', lastName: 'Martin' },
          parent: { firstName: 'Jean', lastName: 'Dupont' }
        }
      ])
    }
  }
}));

describe('GET /api/sessions', () => {
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
      modality: 'ONLINE'
    });
    expect(data.sessions[0].student).toEqual({ id: 'stu1', firstName: 'Marie', lastName: 'Dupont' });
    expect(data.sessions[0].coach).toEqual({ id: 'coach1', firstName: 'Pierre', lastName: 'Martin' });
  });
});

