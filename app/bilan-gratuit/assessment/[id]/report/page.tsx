import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { CanonicalReportViewer } from '@/components/bilans/CanonicalReportViewer';

export default async function CanonicalReportPage({ params }: Readonly<{ params: Promise<Readonly<{ id: string }>> }>) {
  const session = await auth();
  if (session?.user?.id === undefined || (session.user.role !== 'ELEVE' && session.user.role !== 'PARENT')) notFound();
  const { id } = await params;
  if (!id.trim()) notFound();
  return <CanonicalReportViewer attemptId={id} />;
}
