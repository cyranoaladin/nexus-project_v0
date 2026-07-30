import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CanonicalAssessmentTeamWorkspace } from '@/components/bilans/CanonicalAssessmentTeamWorkspace';

export default async function CanonicalBilansTeamPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user) redirect('/auth/signin');
  if (role !== 'ADMIN' && role !== 'COACH' && role !== 'ASSISTANTE') {
    redirect('/dashboard');
  }
  return <CanonicalAssessmentTeamWorkspace role={role} />;
}
