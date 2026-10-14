// ═══════════════════════════════════════════════════════════════════════════════
// NPC Report Page - Coach View
// Comprehensive diagnostic visualization
// ═══════════════════════════════════════════════════════════════════════════════

import { auth } from '@/auth';
import { PedagogicalReportView } from '@/components/npc/PedagogicalReportView';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { ArrowLeft,Download,FileText,Printer } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

interface ReportPageProps {
  params: Promise<{ reportId: string }>;
}

export const metadata = {
  title: 'NPC - Diagnostic Pédagogique',
  description: 'Rapport d\'analyse pédagogique complet',
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { reportId } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== 'COACH') {
    redirect('/auth/signin');
  }

  // Fetch report with all relations
  const report = await prisma.pedagogicalReport.findUnique({
    where: { id: reportId },
    include: {
      copySubmission: {
        include: {
          student: {
            include: { user: true },
          },
          pages: true,
        },
      },
      competenceMatrix: true,
      remediationRoadmap: {
        include: { tasks: true },
      },
    },
  });

  if (!report || !report.copySubmission) {
    redirect('/dashboard/coach/npc');
  }

  const submission = report.copySubmission;

  // Verify coach access
  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!coach) {
    redirect('/dashboard');
  }

  const isOwner = submission.coachId === coach.id;
  const isAssigned = await prisma.coachStudentAssignment.findFirst({
    where: {
      coachId: coach.id,
      studentId: submission.studentId,
    },
  });

  if (!isOwner && !isAssigned) {
    redirect('/dashboard/coach/npc');
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/coach/npc">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Diagnostic Pédagogique</h1>
            <div className="flex items-center gap-2 mt-1 text-gray-600">
              <FileText className="h-4 w-4" />
              <span>{submission.title}</span>
              <span className="text-gray-400">•</span>
              <span>{submission.student.user.firstName && submission.student.user.lastName ? `${submission.student.user.firstName} ${submission.student.user.lastName}` : 'Élève'}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <PedagogicalReportView report={report} showVisibility />
    </div>
  );
}
