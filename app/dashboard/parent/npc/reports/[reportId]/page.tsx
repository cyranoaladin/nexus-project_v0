// ═══════════════════════════════════════════════════════════════════════════════
// NPC Report Page — vue famille (parent)
// Diagnostic complet, seulement s'il est partagé avec la famille (COACH_AND_STUDENT).
// ═══════════════════════════════════════════════════════════════════════════════

import { auth } from '@/auth';
import { PedagogicalReportView } from '@/components/npc/PedagogicalReportView';
import { Button } from '@/components/ui/button';
import { loadFamilyReport } from '@/lib/npc/family-report-access';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

interface ReportPageProps {
  params: Promise<{ reportId: string }>;
}

export const metadata = {
  title: 'NPC - Diagnostic de votre enfant',
  description: 'Diagnostic pédagogique partagé par le coach',
};

export default async function ParentNpcReportPage({ params }: ReportPageProps) {
  const { reportId } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== 'PARENT') {
    redirect('/auth/signin');
  }

  const report = await loadFamilyReport({ reportId, audience: 'parent', userId: session.user.id });
  if (!report || !report.copySubmission) {
    redirect('/dashboard/parent/npc');
  }

  const eleve = report.copySubmission.student.user;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/parent/npc">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Diagnostic de votre enfant</h1>
          <div className="flex items-center gap-2 mt-1 text-gray-600">
            <FileText className="h-4 w-4" />
            <span>{report.copySubmission.title}</span>
            <span className="text-gray-400">•</span>
            <span>{eleve.firstName && eleve.lastName ? `${eleve.firstName} ${eleve.lastName}` : 'Élève'}</span>
          </div>
        </div>
      </div>
      <PedagogicalReportView report={report} />
    </div>
  );
}
