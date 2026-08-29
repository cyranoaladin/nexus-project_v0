import { auth } from '@/auth';
import { GET, PUT } from '@/app/api/aria/profile/route';
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

describe('ARIA Profile API Route (/api/aria/profile)', () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as unknown as {
    student: { findUnique: jest.Mock };
    ariaLearningProfile: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  const validStudent = {
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

  describe('GET', () => {
    it('renvoie 401 si non authentifié', async () => {
      mockAuth.mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost:3000/api/aria/profile');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('renvoie le profil existant', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
      mockPrisma.student.findUnique.mockResolvedValueOnce(validStudent);
      mockPrisma.ariaLearningProfile.findUnique.mockResolvedValueOnce({
        studentId: 'student-1',
        selectedCourseKeys: ['eds-maths-terminale'],
        uiPreferences: { theme: 'dark' },
        updatedAt: new Date('2026-08-29T20:00:00Z'),
      });

      const req = new NextRequest('http://localhost:3000/api/aria/profile');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.studentId).toBe('student-1');
      expect(data.profile.selectedCourseKeys).toEqual(['eds-maths-terminale']);
    });
  });

  describe('PUT', () => {
    it('renvoie 400 si les données sont invalides', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
      mockPrisma.student.findUnique.mockResolvedValueOnce(validStudent);

      const req = new NextRequest('http://localhost:3000/api/aria/profile', {
        method: 'PUT',
        body: JSON.stringify({ selectedCourseKeys: 'ceci-nest-pas-un-tableau' }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('renvoie 400 si un cours inconnu du catalogue est soumis', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
      mockPrisma.student.findUnique.mockResolvedValueOnce(validStudent);

      const req = new NextRequest('http://localhost:3000/api/aria/profile', {
        method: 'PUT',
        body: JSON.stringify({ selectedCourseKeys: ['cours-inexistant'] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Clé de cours inconnue');
    });

    it('renvoie 400 si le cours n est pas suivi par l élève', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
      mockPrisma.student.findUnique.mockResolvedValueOnce(validStudent);

      const req = new NextRequest('http://localhost:3000/api/aria/profile', {
        method: 'PUT',
        body: JSON.stringify({ selectedCourseKeys: ['eds-maths-premiere'] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("n'est pas au programme");
    });

    it('met à jour et renvoie le profil pour un cours académiquement valide', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
      mockPrisma.student.findUnique.mockResolvedValueOnce(validStudent);
      mockPrisma.ariaLearningProfile.findUnique.mockResolvedValueOnce(null);
      mockPrisma.ariaLearningProfile.upsert.mockResolvedValueOnce({
        studentId: 'student-1',
        selectedCourseKeys: ['eds-maths-terminale'],
        uiPreferences: {},
        updatedAt: new Date('2026-08-29T20:00:00Z'),
      });

      const req = new NextRequest('http://localhost:3000/api/aria/profile', {
        method: 'PUT',
        body: JSON.stringify({ selectedCourseKeys: ['eds-maths-terminale'] }),
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.selectedCourseKeys).toEqual(['eds-maths-terminale']);
    });
  });
});
