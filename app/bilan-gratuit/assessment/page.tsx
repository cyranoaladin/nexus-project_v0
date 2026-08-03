import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { CanonicalAssessmentRunner } from '@/components/bilans/CanonicalAssessmentRunner';
import { CanonicalAssessmentStart } from '@/components/bilans/CanonicalAssessmentStart';
import { CanonicalAssessmentWaiting } from '@/components/bilans/CanonicalAssessmentWaiting';
import { listEnabledPacks } from '@/lib/bilans/api/pack-access';
import { bilanPackSubjectLabel } from '@/lib/bilans/catalog/subjects';
import { resolveCanonicalRunnerAccess } from '@/lib/bilans/passation/runner-access';
import { bilanPackLevelLabel } from '@/lib/bilans/render/stage-label';

/**
 * Existing public seam. The server resolves ownership and the pack feature flag
 * before a client runner can be mounted.
 */
export default async function BilanAssessmentPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Readonly<{ attemptId?: string }>> }>) {
  const session = await auth();
  const { attemptId = '' } = await searchParams;
  if (session?.user?.id === undefined || session.user.role !== 'ELEVE') notFound();
  if (!attemptId.trim()) {
    const packs = listEnabledPacks().map(({ pack }) => ({
      slug: pack.slug,
      label: `${bilanPackLevelLabel(pack.level)} · ${bilanPackSubjectLabel(pack.subject)}`,
    }));
    return <CanonicalAssessmentStart packs={packs} />;
  }

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
