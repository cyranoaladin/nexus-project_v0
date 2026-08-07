import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ParentDiagnosticPortal } from '@/components/diagnostics/candidat-libre/ParentDiagnosticPortal';
import { isCandidateDiagnosticFeatureEnabled } from '@/lib/diagnostics/candidat-libre/feature-flag';

export const metadata: Metadata = { title: 'Suivi du diagnostic | Nexus Réussite' };
export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ studentId: string }> }
export default async function ParentCandidateDiagnosticPage({ params }: Props) {
  if (!isCandidateDiagnosticFeatureEnabled()) notFound();
  const { studentId } = await params;
  return <ParentDiagnosticPortal studentId={studentId} />;
}
