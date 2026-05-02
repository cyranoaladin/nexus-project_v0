// ═══════════════════════════════════════════════════════════════════════════════
// Student Report List Component
// Simplified view for students to see their reports
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { CopySubmission, PedagogicalReport, CoachProfile, User } from '@prisma/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Clock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface SubmissionWithRelations extends CopySubmission {
  report: PedagogicalReport | null;
  coach: (CoachProfile & { user: Pick<User, 'firstName' | 'lastName'> }) | null;
}

interface StudentReportListProps {
  submissions: SubmissionWithRelations[];
  showStatus?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  PENDING_UPLOAD: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  UPLOADED: { label: 'Uploadé', color: 'bg-blue-100 text-blue-800', icon: FileText },
  PROCESSING_OCR: { label: 'OCR en cours', color: 'bg-purple-100 text-purple-800', icon: Loader2 },
  OCR_FAILED: { label: 'OCR échoué', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  READY_FOR_AI: { label: 'Prêt pour IA', color: 'bg-blue-100 text-blue-800', icon: FileText },
  QUEUED_FOR_ANALYSIS: { label: 'En file', color: 'bg-orange-100 text-orange-800', icon: Clock },
  ANALYZING: { label: 'Analyse en cours', color: 'bg-purple-100 text-purple-800', icon: Loader2 },
  ANALYSIS_FAILED: { label: 'Analyse échouée', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  COMPLETED: { label: 'Terminé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  ARCHIVED: { label: 'Archivé', color: 'bg-gray-100 text-gray-800', icon: FileText },
};

export function StudentReportList({ submissions, showStatus = false }: StudentReportListProps) {
  if (submissions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500">Aucune copie à afficher</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        const status = statusConfig[submission.status];
        const StatusIcon = status.icon;
        const hasReport = submission.report && submission.status === 'COMPLETED';

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
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <span>{submission.subject}</span>
                      {submission.gradeLevel && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span>{submission.gradeLevel}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(submission.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    {submission.coach && (
                      <p className="text-xs text-gray-500 mt-1">
                        Coach: {submission.coach.user.firstName} {submission.coach.user.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {showStatus && (
                    <Badge className={status.color}>{status.label}</Badge>
                  )}

                  {hasReport && (
                    <Link href={`/dashboard/eleve/npc/reports/${submission.report!.id}`}>
                      <Button size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        Voir mon diagnostic
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardHeader>

            {hasReport && submission.report && (
              <CardContent className="pt-0">
                <div className="bg-gray-50 rounded-lg p-4">
                  {/* Extract summary preview from diagnostic data */}
                  {(() => {
                    const diagnostic = submission.report.diagnosticData as {
                      summary?: string;
                      overallLevel?: string;
                      confidenceScore?: number;
                    } | null;

                    if (!diagnostic) return null;

                    const levelLabels: Record<string, string> = {
                      beginner: 'Débutant',
                      developing: 'En développement',
                      proficient: 'Compétent',
                      advanced: 'Avancé',
                      expert: 'Expert',
                    };

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Niveau: {levelLabels[diagnostic.overallLevel || 'developing'] || diagnostic.overallLevel}
                          </Badge>
                          {diagnostic.confidenceScore && (
                            <span className="text-xs text-gray-500">
                              Confiance: {Math.round(diagnostic.confidenceScore * 100)}%
                            </span>
                          )}
                        </div>
                        {diagnostic.summary && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {diagnostic.summary}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
