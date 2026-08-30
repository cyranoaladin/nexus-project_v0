import { redirect } from 'next/navigation';

import { auth } from '@/auth';

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

export async function StaffStudentsPage({ staffRole }: { staffRole: StaffRole }) {
  const session = await auth();

  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=${STAFF_PATHS[staffRole]}`);
  }
  if (session.user.role !== staffRole) {
    redirect(dashboardFor(session.user.role));
  }

  return <StudentsManagementWorkspace staffRole={staffRole} />;
}
