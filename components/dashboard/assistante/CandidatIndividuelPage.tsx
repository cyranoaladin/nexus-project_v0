import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ensureFresh } from '@/lib/config';
import { getPipelineState } from '@/lib/quotes/pipeline-flag';

import { CandidatIndividuelShell, type CandidatIndividuelStaffRole } from './CandidatIndividuelShell';

const STAFF_PATHS: Record<CandidatIndividuelStaffRole, string> = {
  ADMIN: '/dashboard/admin/candidat-individuel',
  ASSISTANTE: '/dashboard/assistante/candidat-individuel',
};

function dashboardFor(role: string): string {
  if (role === 'ADMIN') return '/dashboard/admin';
  if (role === 'ASSISTANTE') return '/dashboard/assistante';
  return '/dashboard';
}

export async function CandidatIndividuelPage({ staffRole }: { staffRole: CandidatIndividuelStaffRole }) {
  const session = await auth();

  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=${STAFF_PATHS[staffRole]}`);
  }
  if (session.user.role !== staffRole) {
    redirect(dashboardFor(session.user.role));
  }

  await ensureFresh();

  return <CandidatIndividuelShell staffRole={staffRole} initialPipelineState={getPipelineState()} />;
}
