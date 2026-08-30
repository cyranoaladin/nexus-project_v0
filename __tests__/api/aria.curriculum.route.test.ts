import { auth } from '@/auth';
import { GET } from '@/app/api/aria/curriculum/route';
import { listAriaCurriculumForActor } from '@/lib/aria/application/curriculum/public';
import { AriaError } from '@/lib/aria/errors';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/aria/application/curriculum/public', () => ({
  listAriaCurriculumForActor: jest.fn(),
}));

describe('GET /api/aria/curriculum', () => {
  const mockAuth = auth as jest.Mock;

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

  it('renvoie NOT_ENROLLED sans détail interne si le profil étudiant n existe pas', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    (listAriaCurriculumForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENROLLED', 404, 'Profil scolaire introuvable.')
    );

    const req = new NextRequest('http://localhost:3000/api/aria/curriculum');
    const res = await GET(req);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'NOT_ENROLLED', retryable: false },
    });
  });

  it('résout et renvoie les cours et le profil pour un élève valide', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'ELEVE' },
    });
    (listAriaCurriculumForActor as jest.Mock).mockResolvedValueOnce({
      courses: [{ courseKey: 'eds-maths-terminale' }],
      profile: {
        studentId: 'student-1',
        pinnedCourseKeys: ['eds-maths-terminale'],
      },
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
    expect(listAriaCurriculumForActor).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
    });
  });
});
