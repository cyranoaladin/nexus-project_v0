import { redirect } from 'next/navigation';
import MathsRevisionClient from './components/MathsRevisionClient';
import { auth } from '@/auth';
import { UserRole } from '@prisma/client';

/**
 * Spécialité Maths Première - Interactive Revision Page
 *
 * Features:
 * - Dashboard with progress tracking
 * - Interactive course sheets with MathJax rendering
 * - Quiz with instant feedback and score tracking
 *
 * Based on B.O. Éducation Nationale 2025-2026 programme.
 */
export default async function MathsPremierePage() {
  const session = await auth();
  const sessionUser = session?.user as {
    id?: string;
    role?: UserRole;
    firstName?: string;
    name?: string;
  } | undefined;

  if (!sessionUser?.id) {
    redirect('/offres');
  }

  const getDashboardRedirect = (role?: UserRole) => {
    switch (role) {
      case UserRole.ELEVE:
        return '/dashboard/eleve';
      case UserRole.PARENT:
        return '/dashboard/parent';
      case UserRole.COACH:
        return '/dashboard/coach';
      case UserRole.ASSISTANTE:
        return '/dashboard/assistante';
      case UserRole.ADMIN:
        return '/dashboard/admin';
      default:
        return '/dashboard';
    }
  };

  const allowedRoles = new Set<UserRole>([
    UserRole.PARENT,
    UserRole.ADMIN,
    UserRole.ASSISTANTE,
    UserRole.COACH,
  ]);

  if (sessionUser.role === UserRole.ELEVE) {
    redirect('/dashboard/eleve/programme/maths');
  } else if (!allowedRoles.has(sessionUser.role as UserRole)) {
    redirect(getDashboardRedirect(sessionUser.role));
  }

  const userId = sessionUser.id;
  const displayName = sessionUser.firstName?.trim() || sessionUser.name?.split(' ')[0] || 'Élève';

  return (
    <MathsRevisionClient user={{ id: userId, name: displayName }} />
  );
}
