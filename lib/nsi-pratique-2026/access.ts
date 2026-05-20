import type { UserRole } from '@prisma/client';
import type { NavigationItem } from '@/components/navigation/navigation-config';
import { prisma } from '@/lib/prisma';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';

export const NSI_PRACTICE_STUDENT_EMAILS = [
  'channoufieya5@gmail.com',
  'raniachannoufi02@gmail.com',
  'walid.meziane-e@ert.tn',
] as const;

const NSI_PRACTICE_PATH_SEGMENT = '/nsi-pratique-2026';

type AccessUser = {
  id?: string | null;
  userId?: string | null;
  email?: string | null;
  role?: UserRole | string | null;
};

export function isNsiPracticeStudentEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (NSI_PRACTICE_STUDENT_EMAILS as readonly string[]).includes(normalized);
}

export async function canAccessNsiPratique(user: AccessUser): Promise<boolean> {
  const userId = user.userId ?? user.id;
  if (!userId || !user.role) return false;

  if (user.role === 'ADMIN') return true;

  if (user.role === 'ELEVE') {
    if (!isNsiPracticeStudentEmail(user.email)) return false;

    const student = await prisma.student.findFirst({
      where: {
        userId,
        specialties: { has: 'NSI' },
      },
      select: { id: true },
    });

    return Boolean(student);
  }

  if (user.role === 'COACH') {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!coach) return false;

    const assignment = await prisma.coachStudentAssignment.findFirst({
      where: {
        coachId: coach.id,
        subjects: { has: 'NSI' },
        student: {
          user: {
            email: { in: [...NSI_PRACTICE_STUDENT_EMAILS], mode: 'insensitive' },
          },
        },
        ...activeAssignmentWhere(),
      },
      select: { id: true },
    });

    return Boolean(assignment);
  }

  return false;
}

export async function filterNsiPratiqueNavigation(
  items: NavigationItem[],
  user: AccessUser,
): Promise<NavigationItem[]> {
  const hasNsiItem = items.some((item) => item.href.includes(NSI_PRACTICE_PATH_SEGMENT));
  if (!hasNsiItem) return items;

  const hasAccess = await canAccessNsiPratique(user);
  if (hasAccess) return items;

  return items.filter((item) => !item.href.includes(NSI_PRACTICE_PATH_SEGMENT));
}
