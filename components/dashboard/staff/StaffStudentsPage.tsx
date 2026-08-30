import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { parseStaffStudentsIntent } from '@/lib/quotes/candidat-individuel-navigation';

import { StudentsManagementWorkspace } from './StudentsManagementWorkspace';

type StaffRole = 'ADMIN' | 'ASSISTANTE';

const STAFF_PATHS: Record<StaffRole, string> = {
  ADMIN: '/dashboard/admin/students',
  ASSISTANTE: '/dashboard/assistante/students',
};

function dashboardFor(role: string): string {
  if (role === 'ADMIN') return '/dashboard/admin';
  if (role === 'ASSISTANTE') return '/dashboard/assistante';
  return '/dashboard';
}

export async function StaffStudentsPage({ staffRole, intent }: { staffRole: StaffRole; intent?: unknown }) {
  const normalizedIntent = parseStaffStudentsIntent(intent);
  const studentsPath = normalizedIntent
    ? `${STAFF_PATHS[staffRole]}?intent=${normalizedIntent}`
    : STAFF_PATHS[staffRole];
  const session = await auth();

  if (!session?.user) {
    const callbackUrl = normalizedIntent ? encodeURIComponent(studentsPath) : studentsPath;
    redirect(`/auth/signin?callbackUrl=${callbackUrl}`);
  }
  if (session.user.role !== staffRole) {
    redirect(dashboardFor(session.user.role));
  }

  return <StudentsManagementWorkspace staffRole={staffRole} intent={normalizedIntent} />;
}
