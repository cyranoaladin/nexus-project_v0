import { prisma } from '@/lib/prisma';
import {
  upsertLearningProfile,
  ensureDefaultProfile,
} from '@/lib/aria/profile/service';
import type { StudentWithEnrollments } from '@/lib/aria/access';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    ariaLearningProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('ARIA Learning Profile Service', () => {
  const mockPrisma = prisma as unknown as {
    ariaLearningProfile: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  const studentContext: StudentWithEnrollments = {
    id: 'student-test-1',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    academicEnrollments: [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
      { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation stricte et invariants', () => {
    it('refuse toute clé de cours inconnue du catalogue', async () => {
      await expect(
        upsertLearningProfile('student-test-1', {
          selectedCourseKeys: ['cours-inconnu-invente'],
        })
      ).rejects.toThrow('Clé de cours inconnue');
    });

    it('refuse un cours non suivi par l élève lorsque le contexte de validation est fourni', async () => {
      await expect(
        upsertLearningProfile(
          'student-test-1',
          {
            selectedCourseKeys: ['eds-maths-premiere'], // L'élève est en Terminale
          },
          studentContext
        )
      ).rejects.toThrow("n'est pas au programme suivi par l'élève");
    });

    it('accepte et persiste un cours académiquement pertinent', async () => {
      mockPrisma.ariaLearningProfile.findUnique.mockResolvedValueOnce(null);
      mockPrisma.ariaLearningProfile.upsert.mockResolvedValueOnce({
        studentId: 'student-test-1',
        selectedCourseKeys: ['eds-maths-terminale'],
        uiPreferences: { theme: 'dark' },
        updatedAt: new Date('2026-08-29T20:00:00Z'),
      });

      const result = await upsertLearningProfile(
        'student-test-1',
        {
          selectedCourseKeys: ['eds-maths-terminale'],
          uiPreferences: { theme: 'dark' },
        },
        studentContext
      );

      expect(result.selectedCourseKeys).toEqual(['eds-maths-terminale']);
      expect(mockPrisma.ariaLearningProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'student-test-1' },
          create: expect.objectContaining({
            studentId: 'student-test-1',
            selectedCourseKeys: ['eds-maths-terminale'],
          }),
        })
      );
    });
  });

  describe('ensureDefaultProfile', () => {
    it('renvoie le profil existant sans réinitialiser', async () => {
      mockPrisma.ariaLearningProfile.findUnique.mockResolvedValueOnce({
        studentId: 'student-test-1',
        selectedCourseKeys: ['eds-maths-terminale'],
        uiPreferences: {},
        updatedAt: new Date('2026-08-29T20:00:00Z'),
      });

      const result = await ensureDefaultProfile(studentContext);
      expect(result.selectedCourseKeys).toEqual(['eds-maths-terminale']);
      expect(mockPrisma.ariaLearningProfile.upsert).not.toHaveBeenCalled();
    });

    it('initialise automatiquement les cours inscrits par défaut', async () => {
      mockPrisma.ariaLearningProfile.findUnique.mockResolvedValue(null);
      mockPrisma.ariaLearningProfile.upsert.mockResolvedValueOnce({
        studentId: 'student-test-1',
        selectedCourseKeys: ['eds-maths-terminale', 'eds-nsi-terminale', 'tc-philo-terminale'],
        uiPreferences: { defaultView: 'cockpit' },
        updatedAt: new Date('2026-08-29T20:00:00Z'),
      });

      const result = await ensureDefaultProfile(studentContext);
      expect(result.studentId).toBe('student-test-1');
      expect(mockPrisma.ariaLearningProfile.upsert).toHaveBeenCalled();
    });
  });
});
