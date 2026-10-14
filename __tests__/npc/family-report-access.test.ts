/**
 * Accès d'une famille (parent ou élève) au diagnostic NPC complet.
 * Seuls les rapports « COACH_AND_STUDENT » d'une copie terminée sont lisibles,
 * par l'élève concerné ou par un de ses parents ; tout autre cas renvoie null
 * (même réponse pour « absent » et « interdit » : pas d'oracle d'existence).
 */
import { loadFamilyReport } from '@/lib/npc/family-report-access';

const findUnique = jest.fn();
const parentFindFirst = jest.fn();
const studentFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    pedagogicalReport: { findUnique: (...args: unknown[]) => findUnique(...args) },
    parentProfile: { findFirst: (...args: unknown[]) => parentFindFirst(...args) },
    student: { findFirst: (...args: unknown[]) => studentFindFirst(...args) },
  },
}));

const rapport = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  studentId: 'eleve-1',
  visibility: 'COACH_AND_STUDENT',
  diagnostic: { summary: 'ok' },
  createdAt: new Date('2026-10-01'),
  coachNotes: 'note interne',
  copySubmission: { id: 's1', title: 'Copie', status: 'COMPLETED', studentId: 'eleve-1', student: { user: { firstName: 'Ali', lastName: 'B' } } },
  competenceMatrix: null,
  remediationRoadmap: null,
  ...over,
});

beforeEach(() => {
  findUnique.mockReset();
  parentFindFirst.mockReset();
  studentFindFirst.mockReset();
});

describe('loadFamilyReport', () => {
  test('le parent de l’élève lit le rapport complet, sans les notes internes du coach', async () => {
    findUnique.mockResolvedValue(rapport());
    parentFindFirst.mockResolvedValue({ id: 'p1' });
    const r = await loadFamilyReport({ reportId: 'r1', audience: 'parent', userId: 'u-parent' });
    expect(r?.id).toBe('r1');
    expect(r).not.toHaveProperty('coachNotes');
    expect(parentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u-parent', children: { some: { id: 'eleve-1' } } },
    }));
  });

  test('un parent d’une autre famille ne lit rien', async () => {
    findUnique.mockResolvedValue(rapport());
    parentFindFirst.mockResolvedValue(null);
    await expect(loadFamilyReport({ reportId: 'r1', audience: 'parent', userId: 'u-autre' })).resolves.toBeNull();
  });

  test('l’élève lit son propre rapport, pas celui d’un autre', async () => {
    findUnique.mockResolvedValue(rapport());
    studentFindFirst.mockResolvedValueOnce({ id: 'eleve-1' }).mockResolvedValueOnce(null);
    await expect(loadFamilyReport({ reportId: 'r1', audience: 'student', userId: 'u-eleve' })).resolves.not.toBeNull();
    await expect(loadFamilyReport({ reportId: 'r1', audience: 'student', userId: 'u-intrus' })).resolves.toBeNull();
    expect(studentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'eleve-1', userId: 'u-eleve' } }));
  });

  test.each(['COACH_ONLY', 'STUDENT_SUMMARY_ONLY'])('visibilité %s : rien pour la famille', async (visibility) => {
    findUnique.mockResolvedValue(rapport({ visibility }));
    parentFindFirst.mockResolvedValue({ id: 'p1' });
    await expect(loadFamilyReport({ reportId: 'r1', audience: 'parent', userId: 'u-parent' })).resolves.toBeNull();
  });

  test('copie non terminée ou rapport absent : rien', async () => {
    findUnique.mockResolvedValueOnce(rapport({ copySubmission: { ...rapport().copySubmission, status: 'PROCESSING' } }));
    parentFindFirst.mockResolvedValue({ id: 'p1' });
    await expect(loadFamilyReport({ reportId: 'r1', audience: 'parent', userId: 'u-parent' })).resolves.toBeNull();
    findUnique.mockResolvedValueOnce(null);
    await expect(loadFamilyReport({ reportId: 'absent', audience: 'parent', userId: 'u-parent' })).resolves.toBeNull();
  });
});
