import type { Metadata } from 'next';
import { DiagnosticPortal } from '@/components/diagnostics/candidat-libre/DiagnosticPortal';

export const metadata: Metadata = {
  title: 'Diagnostic candidat individuel | Nexus Réussite',
  description: 'Parcours sécurisé de diagnostic académique, méthodologique et documentaire.',
};
export const dynamic = 'force-dynamic';

export default function StudentCandidateDiagnosticPage() {
  return <DiagnosticPortal />;
}
