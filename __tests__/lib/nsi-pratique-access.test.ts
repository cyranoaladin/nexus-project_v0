import {
  canAccessNsiPratique,
  filterNsiPratiqueNavigation,
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

describe('NSI Pratique access (DB-driven, no email allowlist)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows ADMIN unconditionally', async () => {
    await expect(canAccessNsiPratique({
      userId: 'admin-1',
      role: 'ADMIN',
    })).resolves.toBe(true);

    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('allows a student whose profile has NSI specialty', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'stu-nsi-1' });

    await expect(canAccessNsiPratique({
      userId: 'user-nsi-student',
      email: 'student.nsi@example.test',
      role: 'ELEVE',
    })).resolves.toBe(true);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-nsi-student',
        specialties: { has: 'NSI' },
      },
      select: { id: true },
    });
  });

  it('accepts the raw NextAuth session user shape with id', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'stu-nsi-2' });

    await expect(canAccessNsiPratique({
      id: 'user-nsi-other',
      email: 'student2.nsi@example.test',
      role: 'ELEVE',
    })).resolves.toBe(true);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-nsi-other',
        specialties: { has: 'NSI' },
      },
      select: { id: true },
    });
  });

  it('denies a student without NSI specialty', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(canAccessNsiPratique({
      userId: 'user-maths-student',
      email: 'student.maths@example.test',
      role: 'ELEVE',
    })).resolves.toBe(false);
  });

  it('denies when userId is missing', async () => {
    await expect(canAccessNsiPratique({
      email: 'student.nsi@example.test',
      role: 'ELEVE',
    })).resolves.toBe(false);
  });

  it('denies when role is missing', async () => {
    await expect(canAccessNsiPratique({
      userId: 'user-1',
      email: 'student.nsi@example.test',
    })).resolves.toBe(false);
  });

  it('allows coaches assigned to an NSI student with active assignment', async () => {
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assign-1' });

    await expect(canAccessNsiPratique({
      userId: 'coach-user-1',
      email: 'coach@example.test',
      role: 'COACH',
    })).resolves.toBe(true);

    expect(prisma.coachStudentAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        coachId: 'coach-profile-1',
        subjects: { has: 'NSI' },
        student: { specialties: { has: 'NSI' } },
      }),
      select: { id: true },
    }));
  });

  it('denies coaches without an active NSI assignment', async () => {
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-other' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(canAccessNsiPratique({
      userId: 'coach-user-2',
      email: 'coach2@example.test',
      role: 'COACH',
    })).resolves.toBe(false);
  });

  it('denies coaches without a coach profile', async () => {
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(canAccessNsiPratique({
      userId: 'coach-user-3',
      role: 'COACH',
    })).resolves.toBe(false);

    expect(prisma.coachStudentAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('denies unknown roles', async () => {
    await expect(canAccessNsiPratique({
      userId: 'user-1',
      role: 'PARENT',
    })).resolves.toBe(false);
  });

  it('filters the sidebar item when access is denied', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(filterNsiPratiqueNavigation(baseItems, {
      userId: 'user-no-nsi',
      email: 'student.maths@example.test',
      role: 'ELEVE',
    })).resolves.toEqual([
      { label: 'Dashboard', href: '/dashboard/eleve', icon: 'Home' },
    ]);
  });

  it('keeps the NSI item when access is granted', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'stu-1' });

    await expect(filterNsiPratiqueNavigation(baseItems, {
      userId: 'user-nsi',
      email: 'student.nsi@example.test',
      role: 'ELEVE',
    })).resolves.toEqual(baseItems);
  });

  it('returns items unchanged when no NSI item is present', async () => {
    const nonNsiItems = [
      { label: 'Dashboard', href: '/dashboard/eleve', icon: 'Home' },
    ];

    await expect(filterNsiPratiqueNavigation(nonNsiItems, {
      userId: 'user-1',
      role: 'ELEVE',
    })).resolves.toEqual(nonNsiItems);

    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });
});
