import { auth } from '@/auth';
import { GET } from '@/app/api/aria/curriculum/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaLearningProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('GET /api/aria/curriculum', () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as unknown as {
    student: { findUnique: jest.Mock };
    ariaLearningProfile: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejette les requêtes non authentifiées avec une erreur 401', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/aria/curriculum');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Accès non autorisé');
  });

  it('rejette les rôles non-élèves avec une erreur 401', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    const req = new NextRequest('http://localhost:3000/api/aria/curriculum');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('renvoie 404 si le profil étudiant n existe pas', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    mockPrisma.student.findUnique.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost:3000/api/aria/curriculum');
    const res = await GET(req);

    expect(res.status).toBe(404);
  });

  it('résout et renvoie les cours et le profil pour un élève valide', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    mockPrisma.student.findUnique.mockResolvedValueOnce({
      id: 'student-1',
      userId: 'user-1',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      academicEnrollments: [
        { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
      ],
      subscriptions: [
        { status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] },
      ],
    });
    mockPrisma.ariaLearningProfile.findUnique.mockResolvedValueOnce({
      studentId: 'student-1',
      selectedCourseKeys: ['eds-maths-terminale'],
      uiPreferences: {},
      updatedAt: new Date(),
    });

    const req = new NextRequest('http://localhost:3000/api/aria/curriculum');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.courses).toBeDefined();
    expect(Array.isArray(data.courses)).toBe(true);
    expect(data.profile).toBeDefined();
    expect(data.profile.studentId).toBe('student-1');

    const courseKeys = data.courses.map((c: { courseKey: string }) => c.courseKey);
    expect(courseKeys).toContain('eds-maths-terminale');
  });
});
