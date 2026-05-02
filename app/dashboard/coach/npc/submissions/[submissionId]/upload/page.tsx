// ═══════════════════════════════════════════════════════════════════════════════
// NPC Upload Page - Coach View
// Drag-drop interface for uploading PDFs and images
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { FileUploadZone } from '@/components/npc/coach/FileUploadZone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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

  // Check if already uploaded
  if (submission.pages.length > 0) {
    redirect(`/dashboard/coach/npc/submissions/${submissionId}`);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Upload Zone */}
        <div className="lg:col-span-2">
          <FileUploadZone
            submissionId={submissionId}
            maxFiles={10}
            maxSizeMB={20}
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
                  <li>Max 20 Mo par fichier</li>
                  <li>Max 20 pages par copie</li>
                </ul>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  L&apos;upload déclenchera automatiquement l&apos;OCR
                  et l&apos;analyse IA. Temps estimé : 2-5 minutes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
