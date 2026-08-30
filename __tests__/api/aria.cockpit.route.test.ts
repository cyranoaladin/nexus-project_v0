import { NextRequest } from 'next/server';
import { GET } from '@/app/api/aria/cockpit/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findUnique: jest.fn(),
    },
    ariaLearningProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    ariaConversation: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/aria/cockpit', () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as unknown as {
    student: { findUnique: jest.Mock };
    ariaLearningProfile: { findUnique: jest.Mock; upsert: jest.Mock };
    ariaConversation: { findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/aria/cockpit');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Accès non autorisé');
  });

  it('retourne 404 si le profil élève n existe pas', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'u1', role: 'ELEVE' },
    });
    mockPrisma.student.findUnique.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/aria/cockpit');
    const res = await GET(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Profil élève introuvable');
  });

  it('retourne 200 avec le payload cockpit complet pour un élève', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'u1', role: 'ELEVE' },
    });
    mockPrisma.student.findUnique.mockResolvedValueOnce({
      id: 's1',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] }],
    });
    mockPrisma.ariaLearningProfile.findUnique.mockResolvedValueOnce({
      studentId: 's1',
      selectedCourseKeys: ['eds-maths-terminale'],
      uiPreferences: {},
      updatedAt: new Date(),
    });
    mockPrisma.ariaConversation.findMany.mockResolvedValueOnce([]);

    const req = new NextRequest('http://localhost/api/aria/cockpit?courseKey=eds-maths-terminale');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.student.id).toBe('s1');
    expect(body.activeCourseKey).toBe('eds-maths-terminale');
    expect(body.courses.length).toBeGreaterThan(0);
    expect(body.activeSkillGraph).not.toBeNull();
  });
});
