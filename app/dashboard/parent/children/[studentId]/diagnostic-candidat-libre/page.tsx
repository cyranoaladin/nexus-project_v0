import type { Metadata } from 'next';
import { ParentDiagnosticPortal } from '@/components/diagnostics/candidat-libre/ParentDiagnosticPortal';

export const metadata: Metadata = { title: 'Suivi du diagnostic | Nexus Réussite' };
export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ studentId: string }> }
export default async function ParentCandidateDiagnosticPage({ params }: Props) {
  const { studentId } = await params;
  return <ParentDiagnosticPortal studentId={studentId} />;
}
