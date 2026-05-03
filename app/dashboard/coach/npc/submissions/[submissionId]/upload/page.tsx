// ═══════════════════════════════════════════════════════════════════════════════
// NPC Upload Page - Coach View
// Drag-drop interface for uploading PDFs and images
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { FileUploadZone } from '@/components/npc/coach/FileUploadZone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ArrowLeft, RefreshCw, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopySubmissionStatus } from '@prisma/client';

interface UploadPageProps {
  params: Promise<{ submissionId: string }>;
}

export const metadata = {
  title: 'NPC - Upload de copie',
  description: 'Uploader une copie pour analyse pédagogique',
};

export default async function UploadPage({ params }: UploadPageProps) {
  const { submissionId } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== 'COACH') {
    redirect('/auth/login');
  }

  // Fetch submission
  const submission = await prisma.copySubmission.findUnique({
    where: { id: submissionId },
    include: {
      student: {
        include: { user: true },
      },
      pages: true,
      report: true,
    },
  });

  if (!submission) {
    redirect('/dashboard/coach/npc');
  }

  // Check coach owns this submission or is assigned to student
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
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/coach/npc">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux copies
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload de copie</h1>
        <div className="flex items-center gap-2 mt-2 text-gray-600">
          <FileText className="h-5 w-5" />
          <span>{submission.title}</span>
          <span className="text-gray-400">•</span>
          <span>{submission.student.user.firstName && submission.student.user.lastName ? `${submission.student.user.firstName} ${submission.student.user.lastName}` : 'Élève'}</span>
          <span className="text-gray-400">•</span>
          <span>{submission.subject}</span>
        </div>
      </div>

      {/* Status Banner */}
      <Card className={`mb-6 ${
        submission.status === CopySubmissionStatus.COMPLETED
          ? 'bg-green-50 border-green-200'
          : submission.status === CopySubmissionStatus.QUEUED_FOR_ANALYSIS ||
            submission.status === CopySubmissionStatus.ANALYZING
          ? 'bg-blue-50 border-blue-200'
          : submission.status === CopySubmissionStatus.ANALYSIS_FAILED
          ? 'bg-red-50 border-red-200'
          : 'bg-gray-50 border-gray-200'
      }`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {submission.status === CopySubmissionStatus.COMPLETED ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : submission.status === CopySubmissionStatus.QUEUED_FOR_ANALYSIS ||
                submission.status === CopySubmissionStatus.ANALYZING ? (
                <Clock className="h-5 w-5 text-blue-600 animate-spin" />
              ) : submission.status === CopySubmissionStatus.ANALYSIS_FAILED ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <FileText className="h-5 w-5 text-gray-600" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {submission.status === CopySubmissionStatus.COMPLETED
                    ? 'Correction terminée'
                    : submission.status === CopySubmissionStatus.QUEUED_FOR_ANALYSIS
                    ? 'Correction en file d\'attente'
                    : submission.status === CopySubmissionStatus.ANALYZING
                    ? 'Analyse en cours'
                    : submission.status === CopySubmissionStatus.ANALYSIS_FAILED
                    ? 'Analyse échouée'
                    : 'Documents à uploader'}
                </p>
                <p className="text-xs text-gray-500">
                  {submission.pages.length} document(s) attaché(s)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{submission.status}</Badge>
              {submission.status === CopySubmissionStatus.COMPLETED && submission.report && (
                <Link href={`/dashboard/coach/npc/reports/${submission.report.id}`}>
                  <Button size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Voir le rapport
                  </Button>
                </Link>
              )}
              {(submission.status === CopySubmissionStatus.QUEUED_FOR_ANALYSIS ||
                submission.status === CopySubmissionStatus.ANALYZING) && (
                <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rafraîchir
                </Button>
              )}
              {submission.status === CopySubmissionStatus.ANALYSIS_FAILED && (
                <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réessayer
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Upload Zone */}
        <div className="lg:col-span-2">
          <FileUploadZone
            submissionId={submissionId}
            maxFiles={10}
            maxSizeMB={10}
            existingDocuments={submission.pages.map((page) => ({
              id: page.id,
              documentType: page.documentType,
              originalFilename: page.originalFilename,
              originalFilePath: page.originalFilePath,
              mimeType: page.mimeType,
              sizeBytes: page.sizeBytes,
              status: page.status,
              createdAt: page.createdAt.toISOString(),
            }))}
          />
        </div>

        {/* Instructions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-900 mb-2">Formats acceptés</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>PDF (recommandé)</li>
                  <li>JPEG / JPG</li>
                  <li>PNG</li>
                  <li>WEBP</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-gray-900 mb-2">Conseils</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Scannez en 300 DPI minimum</li>
                  <li>Assurez une bonne luminosité</li>
                  <li>Évitez les ombres et plis</li>
                  <li>Un fichier par page ou PDF multi-pages</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-gray-900 mb-2">Limites</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Max 10 fichiers</li>
                  <li>Max 10 Mo par fichier</li>
                  <li>Max 20 pages par copie</li>
                </ul>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Ajoutez au moins une copie élève. Sujet, corrigé et barème
                  améliorent fortement la qualité de la correction IA.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
