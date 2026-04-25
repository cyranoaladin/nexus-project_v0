import { auth } from '@/auth';
import { GET } from '@/app/api/student/dashboard/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
  },
}));

describe('GET /api/student/dashboard — STMG payload', () => {
  it('returns STMG modules and no EDS specialties content', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-stmg', role: 'ELEVE' } });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-stmg',
      grade: 'PREMIERE',
      gradeLevel: 'PREMIERE',
      academicTrack: 'STMG',
      specialties: [],
      stmgPathway: 'INDETERMINE',
      school: 'Lycee',
      user: {
        id: 'user-stmg',
        firstName: 'Ines',
        lastName: 'STMG',
        email: 'ines@example.com',
        mathsProgress: [
          { level: 'PREMIERE', track: 'STMG', totalXp: 90, completedChapters: ['CH_STMG_MATH_SUITES'] },
        ],
      },
      subscriptions: [],
      creditTransactions: [],
      sessions: [],
      ariaConversations: [],
      badges: [],
      bilans: [],
    });

    const response = await GET({} as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.student.academicTrack).toBe('STMG');
    expect(body.trackContent.specialties).toBeUndefined();
    expect(body.trackContent.stmgModules).toEqual([
      expect.objectContaining({ module: 'MATHS_STMG', skillGraphRef: 'maths_premiere_stmg' }),
      expect.objectContaining({ module: 'SGN', skillGraphRef: 'sgn_premiere_stmg' }),
      expect.objectContaining({ module: 'MANAGEMENT', skillGraphRef: 'management_premiere_stmg' }),
      expect.objectContaining({ module: 'DROIT_ECO', skillGraphRef: 'droit_eco_premiere_stmg' }),
    ]);
  });
});
