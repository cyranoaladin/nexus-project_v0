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

const baseStudent = {
  id: 'student-db-1',
  grade: 'PREMIERE',
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  specialties: ['MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE'],
  stmgPathway: null,
  school: 'Lycee',
  user: {
    id: 'user-1',
    firstName: 'Nour',
    lastName: 'EDS',
    email: 'nour@example.com',
    mathsProgress: [
      { level: 'PREMIERE', track: 'EDS_GENERALE', totalXp: 120, completedChapters: ['CH_M1_SUITES'] },
    ],
  },
  subscriptions: [],
  creditTransactions: [{ amount: 3 }],
  sessions: [],
  ariaConversations: [],
  badges: [],
  bilans: [],
};

describe('GET /api/student/dashboard — EDS payload', () => {
  it('returns specialties track content for Premiere EDS student', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(baseStudent);

    const response = await GET({} as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.student).toEqual(expect.objectContaining({
      gradeLevel: 'PREMIERE',
      academicTrack: 'EDS_GENERALE',
      specialties: ['MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE'],
    }));
    expect(body.trackContent.specialties).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: 'MATHEMATIQUES', skillGraphRef: 'maths_premiere' }),
      expect.objectContaining({ subject: 'NSI', skillGraphRef: 'nsi_premiere' }),
    ]));
    expect(body.trackContent.stmgModules).toBeUndefined();
  });
});
