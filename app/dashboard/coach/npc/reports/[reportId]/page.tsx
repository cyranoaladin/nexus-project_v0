// ═══════════════════════════════════════════════════════════════════════════════
// NPC Report Page - Coach View
// Comprehensive diagnostic visualization
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { DiagnosticOverview } from '@/components/npc/coach/DiagnosticOverview';
import { CompetenceMatrix } from '@/components/npc/coach/CompetenceMatrix';
import { RemediationRoadmap } from '@/components/npc/coach/RemediationRoadmap';
import { MentorAdvice } from '@/components/npc/coach/MentorAdvice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Download, Printer } from 'lucide-react';
import Link from 'next/link';

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
    redirect('/auth/login');
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

  const diagnosticData = ((report.diagnostic as any)?.diagnosticData || report.diagnostic || {}) as {
    summary: string;
    overallLevel: string;
    confidenceScore: number;
    strengths: Array<{
      title: string;
      description: string;
      evidence: string;
    }>;
    weaknesses: Array<{
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      evidence: string;
    }>;
    keyRecommendations: string[];
  };

  const mentorAdvice = ((report.diagnostic as any)?.mentorAdviceData || report.diagnostic || {}) as {
    personalizedAdvice: string;
    motivationMessage: string;
    studyTips: string[];
    nextSteps: string[];
    encouragement: string;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/coach/npc">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
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

      {/* Status Banner */}
      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge
                variant={report.visibility === 'COACH_ONLY' ? 'destructive' : 'outline'}
                className="text-sm"
              >
                {report.visibility}
              </Badge>
              <span className="text-sm text-gray-600">
                Généré le {new Date(report.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-4">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="competences">Compétences</TabsTrigger>
          <TabsTrigger value="roadmap">Remédiation</TabsTrigger>
          <TabsTrigger value="mentor">Conseils</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DiagnosticOverview
            summary={diagnosticData.summary}
            overallLevel={diagnosticData.overallLevel}
            confidenceScore={diagnosticData.confidenceScore}
            strengths={diagnosticData.strengths}
            weaknesses={diagnosticData.weaknesses}
            recommendations={diagnosticData.keyRecommendations}
          />
        </TabsContent>

        <TabsContent value="competences" className="space-y-6">
          {report.competenceMatrix ? (
            <CompetenceMatrix
              matrix={report.competenceMatrix.matrixData as any}
              globalScore={report.competenceMatrix.globalScore ?? 0}
              globalLevel={(report.competenceMatrix.globalLevel as any) || 'beginner'}
            />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-gray-500">Matrice de compétences non disponible</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-6">
          {report.remediationRoadmap ? (
            <RemediationRoadmap
              roadmap={report.remediationRoadmap.roadmapData as any}
              tasks={report.remediationRoadmap.tasks as any}
            />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-gray-500">Plan de remédiation non disponible</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mentor" className="space-y-6">
          <MentorAdvice advice={mentorAdvice} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
