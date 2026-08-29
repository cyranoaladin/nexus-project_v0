import { auth } from '@/auth';
import { GET } from '@/app/api/aria/resources/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
  },
}));

describe('GET /api/aria/resources', () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as unknown as {
    student: { findUnique: jest.Mock };
  };

  const terminaleStudent = {
    id: 'student-1',
    userId: 'user-1',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    academicEnrollments: [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renvoie 401 si non authentifié', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/aria/resources?courseKey=eds-maths-terminale');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('renvoie 400 si courseKey est manquant ou inconnu', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    const req = new NextRequest('http://localhost:3000/api/aria/resources?courseKey=cours-inconnu');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('renvoie 403 si l élève n est pas inscrit au cours', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    mockPrisma.student.findUnique.mockResolvedValueOnce(terminaleStudent);

    // Cours de Première alors que l'élève est en Terminale
    const req = new NextRequest('http://localhost:3000/api/aria/resources?courseKey=eds-maths-premiere');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('ne fait pas partie de votre scolarité');
  });

  it('renvoie 200 et la liste des ressources pour un cours valide', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    mockPrisma.student.findUnique.mockResolvedValueOnce(terminaleStudent);

    const req = new NextRequest('http://localhost:3000/api/aria/resources?courseKey=eds-maths-terminale');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resources).toBeDefined();
    expect(data.resources.length).toBeGreaterThan(0);
    for (const r of data.resources) {
      expect(r.courseKey).toBe('eds-maths-terminale');
    }
  });
});
