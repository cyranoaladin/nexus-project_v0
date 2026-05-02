// ═══════════════════════════════════════════════════════════════════════════════
// Parent Report List Component
// View of children's diagnostics for parents
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { CopySubmission, PedagogicalReport, CoachProfile, User } from '@prisma/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface SubmissionWithRelations extends CopySubmission {
  report: PedagogicalReport | null;
  coach: (CoachProfile & { user: Pick<User, 'firstName' | 'lastName'> }) | null;
}

interface ParentReportListProps {
  submissions: SubmissionWithRelations[];
}

const levelLabels: Record<string, string> = {
  beginner: 'Débutant',
  developing: 'En développement',
  proficient: 'Compétent',
  advanced: 'Avancé',
  expert: 'Expert',
};

const levelColors: Record<string, string> = {
  beginner: 'bg-red-100 text-red-800',
  developing: 'bg-orange-100 text-orange-800',
  proficient: 'bg-blue-100 text-blue-800',
  advanced: 'bg-purple-100 text-purple-800',
  expert: 'bg-green-100 text-green-800',
};

export function ParentReportList({ submissions }: ParentReportListProps) {
  if (submissions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500">Aucune copie analysée pour le moment</p>
        <p className="text-sm text-gray-400 mt-1">
          Les diagnostics apparaîtront ici dès qu&apos;ils seront disponibles
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        const hasReport = submission.report && submission.status === 'COMPLETED';

        return (
          <Card key={submission.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      hasReport ? 'bg-green-100' : 'bg-yellow-100'
                    }`}
                  >
                    {hasReport ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    )}
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
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasReport ? (
                    <>
                      {/* Level Badge */}
                      {(() => {
                        const diagnostic = submission.report!.diagnosticData as {
                          overallLevel?: string;
                        } | null;
                        const level = diagnostic?.overallLevel || 'developing';
                        return (
                          <Badge className={levelColors[level]}>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {levelLabels[level]}
                          </Badge>
                        );
                      })()}

                      <Link href={`/dashboard/parent/npc/reports/${submission.report!.id}`}>
                        <Button size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Voir le diagnostic
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600">
                      En cours d&apos;analyse
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            {hasReport && submission.report && (
              <CardContent className="pt-0">
                <div className="bg-gray-50 rounded-lg p-4">
                  {(() => {
                    const diagnostic = submission.report.diagnosticData as {
                      summary?: string;
                      strengths?: Array<{ title: string }>;
                      weaknesses?: Array<{ title: string }>;
                      confidenceScore?: number;
                    } | null;

                    if (!diagnostic) return null;

                    return (
                      <div className="space-y-3">
                        {/* Summary */}
                        {diagnostic.summary && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {diagnostic.summary}
                          </p>
                        )}

                        {/* Quick Stats */}
                        <div className="flex flex-wrap gap-2">
                          {diagnostic.strengths && diagnostic.strengths.length > 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              {diagnostic.strengths.length} point(s) fort(s)
                            </Badge>
                          )}
                          {diagnostic.weaknesses && diagnostic.weaknesses.length > 0 && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700">
                              {diagnostic.weaknesses.length} point(s) à travailler
                            </Badge>
                          )}
                          {diagnostic.confidenceScore && (
                            <Badge variant="outline" className="text-gray-600">
                              Confiance: {Math.round(diagnostic.confidenceScore * 100)}%
                            </Badge>
                          )}
                        </div>

                        {/* Coach */}
                        {submission.coach && (
                          <p className="text-xs text-gray-500">
                            Analysé par: {submission.coach.user.firstName} {submission.coach.user.lastName}
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
