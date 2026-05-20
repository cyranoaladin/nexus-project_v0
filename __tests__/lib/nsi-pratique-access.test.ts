import {
  NSI_PRACTICE_STUDENT_EMAILS,
  canAccessNsiPratique,
  filterNsiPratiqueNavigation,
  isNsiPracticeStudentEmail,
} from '@/lib/nsi-pratique-2026/access';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findFirst: jest.fn(),
    },
    coachProfile: {
      findUnique: jest.fn(),
    },
    coachStudentAssignment: {
      findFirst: jest.fn(),
    },
  },
}));

const baseItems = [
  { label: 'Dashboard', href: '/dashboard/eleve', icon: 'Home' },
  { label: 'NSI Pratique', href: '/dashboard/eleve/nsi-pratique-2026', icon: 'Code2' },
];

describe('NSI Pratique access', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recognizes the requested student emails case-insensitively', () => {
    expect(isNsiPracticeStudentEmail('channoufieya5@gmail.com')).toBe(true);
    expect(isNsiPracticeStudentEmail('RaniaChannoufi02@GMAIL.COM')).toBe(true);
    expect(isNsiPracticeStudentEmail('Walid.Meziane-E@ERT.TN')).toBe(true);
    expect(isNsiPracticeStudentEmail('other@example.com')).toBe(false);
    expect(NSI_PRACTICE_STUDENT_EMAILS).toHaveLength(3);
  });

  it('allows one of the requested students when their profile has NSI', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'stu_eya_nsi' });

    await expect(canAccessNsiPratique({
      userId: 'user-eya',
      email: 'channoufieya5@gmail.com',
      role: 'ELEVE',
    })).resolves.toBe(true);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-eya',
        specialties: { has: 'NSI' },
      },
      select: { id: true },
    });
  });

  it('accepts the raw NextAuth session user shape with id', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'stu_rania_nsi' });

    await expect(canAccessNsiPratique({
      id: 'user-rania',
      email: 'raniachannoufi02@gmail.com',
      role: 'ELEVE',
    })).resolves.toBe(true);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-rania',
        specialties: { has: 'NSI' },
      },
      select: { id: true },
    });
  });

  it('denies other students even if they are ELEVE', async () => {
    await expect(canAccessNsiPratique({
      userId: 'user-other',
      email: 'other@example.com',
      role: 'ELEVE',
    })).resolves.toBe(false);

    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('allows coaches assigned in NSI to one of the requested students', async () => {
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-pierre' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assign-1' });

    await expect(canAccessNsiPratique({
      userId: 'coach-user',
      email: 'pierre.caillabet65@gmail.com',
      role: 'COACH',
    })).resolves.toBe(true);

    expect(prisma.coachStudentAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        coachId: 'coach-pierre',
        subjects: { has: 'NSI' },
      }),
      select: { id: true },
    }));
  });

  it('denies coaches without an active NSI assignment to these students', async () => {
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-other' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(canAccessNsiPratique({
      userId: 'coach-user',
      email: 'coach@example.com',
      role: 'COACH',
    })).resolves.toBe(false);
  });

  it('filters the sidebar item when access is denied', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(filterNsiPratiqueNavigation(baseItems, {
      userId: 'user-other',
      email: 'other@example.com',
      role: 'ELEVE',
    })).resolves.toEqual([
      { label: 'Dashboard', href: '/dashboard/eleve', icon: 'Home' },
    ]);
  });
});
