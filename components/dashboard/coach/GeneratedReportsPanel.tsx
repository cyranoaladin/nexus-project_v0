"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, Download, AlertCircle } from 'lucide-react';

interface Report {
  id: string;
  stageSlug: string;
  subject: string;
  kind: string;
  status: string;
  pdfUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string | null;
}

interface Readiness {
  eafStagePost?: {
    studentBilanReady: boolean;
    coachReportValidated: boolean;
    coachCompletionRatio: number;
    missingCoachFields: string[];
  };
}

interface GeneratedReportsPanelProps {
  studentId: string;
}

export function GeneratedReportsPanel({ studentId }: GeneratedReportsPanelProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [readiness, setReadiness] = useState<Readiness>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/coach/students/${studentId}/generated-reports`);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
        setReadiness(data.readiness || {});
      } else {
        setError(data.message || 'Impossible de charger les bilans.');
      }
    } catch (err) {
      setError('Erreur lors du chargement des bilans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [studentId]);

  const handleCreateJob = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/coach/students/${studentId}/generated-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'FRANCAIS',
          kind: 'EAF_STAGE_POST',
          stageSlug: 'stage-printemps-2026',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchReports();
      } else {
        setError(data.message || 'Impossible de créer la demande de génération.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du bilan.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (reportId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/coach/students/${studentId}/generated-reports/${reportId}/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      await fetchReports();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération.');
    } finally {
      setLoading(false);
    }
  };

  const eafReady = readiness.eafStagePost;
  const canCreateEafJob = Boolean(eafReady?.studentBilanReady && eafReady?.coachReportValidated);
  const hasEafReport = reports.some((report) => report.kind === 'EAF_STAGE_POST');

  return (
    <Card className="bg-surface-card border-white/10 shadow-premium">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-accent" />
          Bilans Pédagogiques Générés
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchReports}
          disabled={loading}
          className="text-neutral-400 hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {eafReady && (!eafReady.studentBilanReady || !eafReady.coachReportValidated) && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
            {!eafReady.studentBilanReady && <p>En attente du questionnaire élève EAF complété.</p>}
            {!eafReady.coachReportValidated && (
              <p>En attente de validation du bilan coach EAF ({eafReady.coachCompletionRatio}% complété).</p>
            )}
          </div>
        )}

        {canCreateEafJob && !hasEafReport && (
          <Button
            size="sm"
            onClick={handleCreateJob}
            disabled={loading}
            className="bg-brand-accent text-neutral-900 hover:bg-brand-accent/90 text-xs font-semibold"
          >
            Créer la demande EAF
          </Button>
        )}

        {reports.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">Aucun bilan généré pour le moment.</p>
        ) : (
          <ul className="divide-y divide-white/5 space-y-2">
            {reports.map((report) => (
              <li key={report.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-200">
                      {report.kind === 'EAF_STAGE_POST' ? 'EAF post-stage' : 'Mathématiques post-stage'} · {report.subject}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                        report.status === 'PDF_READY'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : report.status === 'FAILED'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>
                  {report.errorMessage && (
                    <p className="text-[10px] text-red-400 italic bg-red-500/5 p-1 rounded">
                      Erreur : {report.errorMessage}
                    </p>
                  )}
                  <p className="text-[10px] text-neutral-500">
                    {report.generatedAt
                      ? `Généré le : ${new Date(report.generatedAt).toLocaleDateString('fr-FR')}`
                      : `Mis à jour le : ${new Date(report.updatedAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {['PENDING', 'FAILED', 'NEEDS_REVIEW'].includes(report.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegenerate(report.id)}
                      disabled={loading}
                      className="text-neutral-300 border-white/10 hover:bg-white/5 hover:text-white px-2 py-1 text-[10px]"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      {report.status === 'PENDING' ? 'Générer' : 'Relancer'}
                    </Button>
                  )}
                  {report.status === 'PDF_READY' && report.pdfUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="text-brand-accent border-brand-accent/20 hover:bg-brand-accent/5 px-2 py-1 text-[10px]"
                    >
                      <a href={report.pdfUrl}>
                        <Download className="w-3 h-3 mr-1" />
                        Télécharger
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
