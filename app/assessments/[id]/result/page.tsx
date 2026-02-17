/**
 * Assessment Result Page — Premium
 * 
 * Displays the complete assessment results with:
 * - SSN card with classification and cohort percentile
 * - Radar chart for domain scores
 * - Skill heatmap for granular competencies
 * - Tabs for different audiences (student/parents)
 * - PDF export and share actions
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactMarkdown from 'react-markdown';
import SSNCard from '@/components/assessments/SSNCard';
import ResultRadar from '@/components/assessments/ResultRadar';
import SkillHeatmap from '@/components/assessments/SkillHeatmap';
import SimulationPanel from '@/components/assessments/SimulationPanel';

interface AssessmentResult {
  id: string;
  subject: string;
  grade: string;
  studentName: string;
  studentEmail: string;
  globalScore: number;
  confidenceIndex: number;
  scoringResult: Record<string, unknown>;
  analysisJson: Record<string, unknown>;
  studentMarkdown: string;
  parentsMarkdown: string;
  createdAt: string;
  // Learning Graph v2 fields
  ssn: number | null;
  domainScores: { domain: string; score: number }[];
  skillScores: { skillTag: string; score: number }[];
  percentile: number | null;
  // Cohort context
  cohortMean: number;
  cohortStd: number;
  cohortN: number;
  isLowSample: boolean;
}

/** Map subject codes to French labels */
function getSubjectLabel(subject: string): string {
  switch (subject) {
    case 'MATHS': return 'Mathématiques';
    case 'NSI': return 'NSI';
    case 'GENERAL': return 'Transversal';
    default: return subject;
  }
}

export default function AssessmentResultPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  // Unwrap params Promise
  useEffect(() => {
    params.then((p) => setAssessmentId(p.id));
  }, [params]);

  useEffect(() => {
    if (!assessmentId) return;

    const fetchResult = async () => {
      try {
        const response = await fetch(`/api/assessments/${assessmentId}/result`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Évaluation introuvable');
            return;
          }
          throw new Error('Erreur lors de la récupération des résultats');
        }

        const data: AssessmentResult = await response.json();
        setResult(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [assessmentId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-slate-400">Chargement des résultats...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Erreur</h1>
            <p className="text-lg text-slate-400">{error || 'Résultats introuvables'}</p>
          </div>
          <Button onClick={() => router.push('/')} variant="outline">
            Retour à l&apos;accueil
          </Button>
        </div>
      </div>
    );
  }

  // Main result view
  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold">Bilan d&apos;Excellence Nexus</h1>
              <p className="text-lg text-slate-400 mt-2">
                {getSubjectLabel(result.subject)} •{' '}
                {result.grade === 'PREMIERE' ? 'Première' : 'Terminale'} •{' '}
                {result.studentName}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (assessmentId) {
                    window.open(`/api/assessments/${assessmentId}/export`, '_blank');
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Partager
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Score Cards Row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SSN Card (primary) */}
          <SSNCard
            ssn={result.ssn}
            globalScore={result.globalScore}
            percentile={result.percentile}
          />
          {result.isLowSample && (
            <div className="col-span-1 md:col-span-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 text-center">
              Cohorte restreinte (n={result.cohortN}) — le SSN et le percentile sont des estimations.
            </div>
          )}

          {/* Confidence Index Card */}
          <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-xl border border-blue-500/30">
            <div className="text-sm text-slate-400 mb-1">Indice de Confiance</div>
            <div className="text-5xl font-bold text-blue-400">
              {result.confidenceIndex}
              <span className="text-lg font-normal text-slate-400">/100</span>
            </div>
            <div className="text-sm text-slate-300 mt-3">
              {result.confidenceIndex >= 80 && 'Très fiable — réponses cohérentes et assurées'}
              {result.confidenceIndex >= 60 && result.confidenceIndex < 80 && 'Fiable — bonne lucidité sur ses compétences'}
              {result.confidenceIndex < 60 && 'À confirmer — tendance à répondre au hasard'}
            </div>
          </div>
        </div>

        {/* ─── Radar + Heatmap Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Radar Chart */}
          <ResultRadar data={result.domainScores} />

          {/* Skill Heatmap */}
          <SkillHeatmap data={result.skillScores} />
        </div>

        {/* ─── Simulation Panel ─────────────────────────────────────────────── */}
        {result.domainScores.length > 0 && (
          <SimulationPanel
            domainScores={result.domainScores}
            currentSSN={result.ssn}
            currentGlobalScore={result.globalScore}
            cohortMean={result.cohortMean}
            cohortStd={result.cohortStd}
            currentPercentile={result.percentile}
          />
        )}

        {/* ─── Bilan Tabs ──────────────────────────────────────────────────── */}
        <Tabs defaultValue="student" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student">Pour l&apos;Élève</TabsTrigger>
            <TabsTrigger value="parents">Pour les Parents</TabsTrigger>
          </TabsList>

          <TabsContent value="student" className="space-y-4">
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{result.studentMarkdown}</ReactMarkdown>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="parents" className="space-y-4">
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{result.parentsMarkdown}</ReactMarkdown>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Button size="lg" onClick={() => router.push('/dashboard')}>
            Retour au Dashboard
          </Button>
          <Button size="lg" variant="outline" onClick={() => window.print()}>
            Imprimer
          </Button>
        </div>

        {/* Footer info */}
        <div className="text-center text-sm text-slate-500">
          <p>Évaluation réalisée le {new Date(result.createdAt).toLocaleDateString('fr-FR')}</p>
          <p className="mt-1">ID: {result.id}</p>
        </div>
      </div>
    </div>
  );
}
