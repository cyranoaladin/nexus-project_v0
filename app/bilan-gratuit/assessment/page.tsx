import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { CanonicalAssessmentRunner } from '@/components/bilans/CanonicalAssessmentRunner';
import { CanonicalAssessmentWaiting } from '@/components/bilans/CanonicalAssessmentWaiting';
import { resolveCanonicalRunnerAccess } from '@/lib/bilans/passation/runner-access';

/**
 * Existing public seam. The server resolves ownership and the pack feature flag
 * before a client runner can be mounted.
 */
export default async function BilanAssessmentPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Readonly<{ attemptId?: string }>> }>) {
  const session = await auth();
  const { attemptId = '' } = await searchParams;
  if (session?.user?.id === undefined || session.user.role === undefined) notFound();

  try {
    const access = await resolveCanonicalRunnerAccess({
      attemptId,
      userId: session.user.id,
      role: session.user.role,
    });
    if (access.state === 'WAITING') return <CanonicalAssessmentWaiting />;
    return <CanonicalAssessmentRunner attemptId={access.attemptId} />;
  } catch {
    notFound();
  }
}
