'use client';

import React from 'react';
import { Download, CheckCircle, ArrowRight, Printer } from 'lucide-react';
import ScoreHeader from '@/components/stages/results/ScoreHeader';
import CompetenceRadar from '@/components/stages/results/CompetenceRadar';
import DetailedAnalysis from '@/components/stages/results/DetailedAnalysis';

interface ReservationData {
  id: string;
  parentName: string;
  studentName: string | null;
  email: string;
  academyTitle: string;
  status: string;
  createdAt: string;
}

interface BilanClientProps {
  reservation: ReservationData;
  scoringResult: Record<string, unknown>;
}

export default function BilanClient({ reservation, scoringResult }: BilanClientProps) {
  const sr = scoringResult;

  const globalScore = (sr.globalScore as number) ?? 0;
  const confidenceIndex = (sr.confidenceIndex as number) ?? 0;
  const precisionIndex = (sr.precisionIndex as number) ?? 0;
  const diagnosticText = (sr.diagnosticText as string) ?? '';
  const lucidityText = (sr.lucidityText as string) ?? '';
  const totalQuestions = (sr.totalQuestions as number) ?? 0;
  const totalAttempted = (sr.totalAttempted as number) ?? 0;
  const totalCorrect = (sr.totalCorrect as number) ?? 0;
  const totalNSP = (sr.totalNSP as number) ?? 0;
  const radarData = (sr.radarData as Array<{ subject: string; score: number; confidence: number }>) ?? [];
  const strengths = (sr.strengths as string[]) ?? [];
  const weaknesses = (sr.weaknesses as string[]) ?? [];
  const categoryScores = (sr.categoryScores as Array<{
    category: string;
    subject: string;
    precision: number;
    confidence: number;
    totalQuestions: number;
    attemptedQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    nspAnswers: number;
    weightedScore: number;
    weightedMax: number;
    tag: string;
  }>) ?? [];
  const nsiErrors = (sr.nsiErrors as { syntaxErrors: number; logicErrors: number; conceptualErrors: number; totalErrors: number } | null) ?? null;
  const basesFragiles = (sr.basesFragiles as Array<{ category: string; basicsFailed: number; expertPassed: number; message: string }>) ?? [];
  const scoredAt = (sr.scoredAt as string) ?? '';

  const handlePrint = () => {
    window.print();
  };

  const handleConfirm = async () => {
    try {
      const res = await fetch('/api/reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: reservation.parentName,
          studentName: reservation.studentName,
          email: reservation.email,
          phone: '00000000',
          classe: 'Terminale',
          academyId: 'confirm',
          academyTitle: reservation.academyTitle,
          price: 0,
        }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // Silent fail — not critical
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Header bar — no print */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Bilan de Positionnement</p>
            <p className="text-xs text-slate-500">{reservation.academyTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer / PDF
            </button>
            <a
              href="/stages/fevrier-2026"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-black transition-colors"
            >
              Retour au stage
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Score Header */}
        <ScoreHeader
          globalScore={globalScore}
          confidenceIndex={confidenceIndex}
          precisionIndex={precisionIndex}
          diagnosticText={diagnosticText}
          lucidityText={lucidityText}
          totalQuestions={totalQuestions}
          totalAttempted={totalAttempted}
          totalCorrect={totalCorrect}
          totalNSP={totalNSP}
          studentName={reservation.studentName || reservation.parentName}
        />

        {/* Radar Chart */}
        <CompetenceRadar radarData={radarData} />

        {/* Detailed Analysis */}
        <div className="print-break">
          <DetailedAnalysis
            categoryScores={categoryScores}
            strengths={strengths}
            weaknesses={weaknesses}
            nsiErrors={nsiErrors}
            basesFragiles={basesFragiles}
          />
        </div>

        {/* CTA Section — no print */}
        <div className="no-print">
          {reservation.status === 'PENDING' && (
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-center text-white">
              <h2 className="text-xl font-black mb-2">Prêt pour le stage ?</h2>
              <p className="text-sm text-blue-100 mb-6 max-w-md mx-auto">
                Ton bilan est prêt. Confirme ta présence pour que nous puissions
                te placer dans le groupe le plus adapté à ton profil.
              </p>
              <button
                onClick={handleConfirm}
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg"
              >
                <CheckCircle className="w-5 h-5" />
                Confirmer ma présence
              </button>
            </div>
          )}

          {reservation.status !== 'PENDING' && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-green-900 mb-1">Inscription confirmée</h2>
              <p className="text-sm text-green-700">
                Tu es inscrit(e) au stage. Un coach te contactera bientôt pour préparer ta venue.
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400 py-4">
          <p>Diagnostic réalisé le {scoredAt ? new Date(scoredAt).toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          }) : 'N/A'}</p>
          <p className="mt-1">Nexus Réussite — Stage Février 2026</p>
          <p className="mt-1 no-print">ID: {reservation.id}</p>
        </div>
      </main>
    </div>
  );
}
