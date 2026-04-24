import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, MathsLevel } from '@prisma/client';
import { MathJaxProvider } from '../maths-1ere/components/MathJaxProvider';
import MathsTerminaleClient from './components/MathsTerminaleClient';

export default async function MathsTerminalePage() {
  const callbackUrl = '/programme/maths-terminale';
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: UserRole; firstName?: string; name?: string } | undefined;

  if (!sessionUser?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const getDashboardRedirect = (role?: UserRole) => {
    switch (role) {
      case UserRole.ELEVE: return '/dashboard/eleve';
      case UserRole.PARENT: return '/dashboard/parent';
      case UserRole.COACH: return '/dashboard/coach';
      case UserRole.ASSISTANTE: return '/dashboard/assistante';
      case UserRole.ADMIN: return '/dashboard/admin';
      default: return '/dashboard';
    }
  };

  const allowedRoles = new Set<UserRole>([
    UserRole.PARENT,
    UserRole.ADMIN,
    UserRole.ASSISTANTE,
    UserRole.COACH,
  ]);

  if (sessionUser.role === UserRole.ELEVE) {
    const student = await prisma.student.findUnique({
      where: { userId: sessionUser.id },
      select: { grade: true },
    });

    if (student?.grade !== MathsLevel.TERMINALE) {
      redirect(getDashboardRedirect(sessionUser.role));
    }
  } else if (!allowedRoles.has(sessionUser.role as UserRole)) {
    redirect(getDashboardRedirect(sessionUser.role));
  }

  const userId = sessionUser.id;
  const displayName = sessionUser.firstName?.trim() || sessionUser.name?.split(' ')[0] || 'Élève';

  return (
    <MathJaxProvider>
      <MathsTerminaleClient userId={userId} initialDisplayName={displayName} />
    </MathJaxProvider>
  );
}
