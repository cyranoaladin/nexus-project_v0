import type { UserRole } from '@prisma/client';
import type { NavigationItem } from '@/components/navigation/navigation-config';
import { prisma } from '@/lib/prisma';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';

const NSI_PRACTICE_PATH_SEGMENT = '/nsi-pratique-2026';

type AccessUser = {
  id?: string | null;
  userId?: string | null;
  email?: string | null;
  role?: UserRole | string | null;
};

/**
 * Determines whether a user can access the NSI Pratique 2026 module.
 * Access is DB-driven — no hardcoded email allowlists.
 *
 * - ADMIN: always allowed.
 * - ELEVE: allowed if Student.specialties includes NSI.
 * - COACH: allowed if assigned to at least one NSI student with an active assignment.
 */
export async function canAccessNsiPratique(user: AccessUser): Promise<boolean> {
  const userId = user.userId ?? user.id;
  if (!userId || !user.role) return false;

  if (user.role === 'ADMIN') return true;

  if (user.role === 'ELEVE') {
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
          specialties: { has: 'NSI' },
        },
        ...activeAssignmentWhere(),
      },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  return false;
}

/**
 * Filters navigation items: hides NSI entry when the user has no access.
 */
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
