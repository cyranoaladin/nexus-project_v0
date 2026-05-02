// ═══════════════════════════════════════════════════════════════════════════════
// Copy Submission List Component
// Displays submissions with status and actions
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CopySubmission, CopySubmissionStatus, Student, User, PedagogicalReport, AiProcessingJob } from '@prisma/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Upload, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface SubmissionWithRelations extends CopySubmission {
  student: Student & { user: User };
  report: PedagogicalReport | null;
  aiJob: AiProcessingJob | null;
}

interface CopySubmissionListProps {
  submissions: SubmissionWithRelations[];
}

const statusConfig: Record<CopySubmissionStatus, { label: string; color: string; icon: typeof FileText }> = {
  PENDING_UPLOAD: { label: 'Upload en attente', color: 'bg-yellow-100 text-yellow-800', icon: Upload },
  UPLOADED: { label: 'Uploadé', color: 'bg-blue-100 text-blue-800', icon: FileText },
  PROCESSING_OCR: { label: 'OCR en cours', color: 'bg-purple-100 text-purple-800', icon: Clock },
  OCR_FAILED: { label: 'OCR échoué', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  READY_FOR_AI: { label: 'Prêt pour IA', color: 'bg-blue-100 text-blue-800', icon: FileText },
  QUEUED_FOR_ANALYSIS: { label: 'En file d\'attente', color: 'bg-orange-100 text-orange-800', icon: Clock },
  ANALYZING: { label: 'Analyse en cours', color: 'bg-purple-100 text-purple-800', icon: Clock },
  ANALYSIS_FAILED: { label: 'Analyse échouée', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  COMPLETED: { label: 'Terminé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  ARCHIVED: { label: 'Archivé', color: 'bg-gray-100 text-gray-800', icon: FileText },
};

export function CopySubmissionList({ submissions }: CopySubmissionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (submissions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-500">Aucune copie pour le moment</p>
        <p className="text-sm text-gray-400 mt-1">
          Créez une nouvelle soumission pour commencer
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        const status = statusConfig[submission.status];
        const StatusIcon = status.icon;

        return (
          <Card key={submission.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${status.color}`}>
                    <StatusIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{submission.title}</h3>
                    <p className="text-sm text-gray-500">
                      {submission.student.user.firstName && submission.student.user.lastName ? `${submission.student.user.firstName} ${submission.student.user.lastName}` : 'Élève'} • {submission.subject}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Créé le {new Date(submission.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 mt-2">
                {(submission.status === 'PENDING_UPLOAD' ||
                  submission.status === 'UPLOADED' ||
                  submission.status === 'READY_FOR_AI') && (
                  <Link href={`/dashboard/coach/npc/submissions/${submission.id}/upload`}>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Gérer les documents
                    </Button>
                  </Link>
                )}

                {submission.status === 'COMPLETED' && submission.report && (
                  <Link href={`/dashboard/coach/npc/reports/${submission.report.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Voir le diagnostic
                    </Button>
                  </Link>
                )}

                {submission.aiJob && (
                  <Badge variant="outline" className="text-xs">
                    {submission.aiJob.status === 'COMPLETED'
                      ? `${submission.aiJob.tokensUsed || 0} tokens`
                      : `Job: ${submission.aiJob.status}`}
                  </Badge>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedId(expandedId === submission.id ? null : submission.id)}
                >
                  {expandedId === submission.id ? 'Moins' : 'Plus'}
                </Button>
              </div>

              {expandedId === submission.id && (
                <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                  <p><strong>ID:</strong> {submission.id}</p>
                  <p><strong>Matière:</strong> {submission.subject}</p>
                  {submission.gradeLevel && <p><strong>Niveau:</strong> {submission.gradeLevel}</p>}
                  {submission.description && (
                    <p><strong>Description:</strong> {submission.description}</p>
                  )}
                  {submission.ocrText && (
                    <div className="mt-2">
                      <p><strong>Texte OCR:</strong></p>
                      <p className="text-xs bg-gray-50 p-2 rounded mt-1 max-h-32 overflow-y-auto">
                        {submission.ocrText.slice(0, 500)}...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
