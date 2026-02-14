'use client';

import React from 'react';
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  Code2,
  Bug,
} from 'lucide-react';

interface CategoryScore {
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
}

interface NSIErrorBreakdown {
  syntaxErrors: number;
  logicErrors: number;
  conceptualErrors: number;
  totalErrors: number;
}

interface BasesFragilesFlag {
  category: string;
  basicsFailed: number;
  expertPassed: number;
  message: string;
}

interface DetailedAnalysisProps {
  categoryScores: CategoryScore[];
  strengths: string[];
  weaknesses: string[];
  nsiErrors: NSIErrorBreakdown | null;
  basesFragiles: BasesFragilesFlag[];
}

const TAG_CONFIG: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  'Maîtrisé': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: <CheckCircle className="w-4 h-4 text-green-600" /> },
  'En progression': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <TrendingUp className="w-4 h-4 text-blue-600" /> },
  'Bases Fragiles': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> },
  'Confusions': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: <XCircle className="w-4 h-4 text-red-600" /> },
  'Insuffisant': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: <XCircle className="w-4 h-4 text-red-600" /> },
  'Notion non abordée': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: <HelpCircle className="w-4 h-4 text-slate-400" /> },
  'À découvrir': { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', icon: <BookOpen className="w-4 h-4 text-slate-400" /> },
};

function getTagConfig(tag: string) {
  return TAG_CONFIG[tag] || TAG_CONFIG['Confusions'];
}

function CategoryCard({ cat }: { cat: CategoryScore }) {
  const config = getTagConfig(cat.tag);
  const isMaths = cat.subject === 'MATHS';
  const barWidth = cat.totalQuestions > 0 ? (cat.correctAnswers / cat.totalQuestions) * 100 : 0;

  return (
    <div className={`rounded-xl border p-4 ${config.bg} ${config.border} print:break-inside-avoid`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isMaths ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isMaths ? 'Maths' : 'NSI'}
          </span>
          <h3 className="font-bold text-slate-900 text-sm">{cat.category}</h3>
        </div>
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
          {config.icon}
          {cat.tag}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              cat.precision >= 70 ? 'bg-green-500' :
              cat.precision >= 50 ? 'bg-blue-500' :
              cat.precision >= 30 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-green-700 font-semibold">{cat.correctAnswers} ✓</span>
        <span className="text-red-600 font-semibold">{cat.incorrectAnswers} ✗</span>
        <span className="text-slate-400">{cat.nspAnswers} NSP</span>
        <span className="ml-auto text-slate-500">
          {Math.round(cat.precision)}% précision
        </span>
      </div>

      {/* Pedagogical message */}
      {cat.nspAnswers > 0 && cat.nspAnswers / cat.totalQuestions > 0.3 && (
        <p className="text-xs text-slate-600 mt-2 italic leading-relaxed">
          Tu as répondu &quot;Je ne sais pas&quot; à {Math.round((cat.nspAnswers / cat.totalQuestions) * 100)}% des questions
          de {cat.category}. C&apos;est un sujet à prioriser pendant le stage.
        </p>
      )}

      {cat.tag === 'Bases Fragiles' && (
        <p className="text-xs text-amber-700 mt-2 italic leading-relaxed">
          Attention : tu réussis des questions difficiles mais échoues sur des bases.
          Il faut consolider les fondamentaux en {cat.category}.
        </p>
      )}

      {cat.tag === 'Confusions' && cat.incorrectAnswers > 0 && (
        <p className="text-xs text-red-600 mt-2 italic leading-relaxed">
          Des confusions détectées en {cat.category} ({cat.incorrectAnswers} erreur{cat.incorrectAnswers > 1 ? 's' : ''}).
          Le stage permettra de clarifier ces notions.
        </p>
      )}
    </div>
  );
}

export default function DetailedAnalysis({
  categoryScores,
  strengths,
  weaknesses,
  nsiErrors,
  basesFragiles,
}: DetailedAnalysisProps) {
  const mathsCategories = categoryScores.filter((c) => c.subject === 'MATHS');
  const nsiCategories = categoryScores.filter((c) => c.subject === 'NSI');

  return (
    <div className="space-y-6">
      {/* Strengths & Weaknesses Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:shadow-none print:border-slate-300">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Points clés</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Strengths */}
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <h3 className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Points forts
            </h3>
            {strengths.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {strengths.map((s) => (
                  <span key={s} className="text-xs font-semibold px-2.5 py-1 bg-green-100 text-green-700 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-green-600 italic">Pas encore de point fort identifié — le stage va t&apos;aider !</p>
            )}
          </div>

          {/* Weaknesses */}
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Points de vigilance
            </h3>
            {weaknesses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {weaknesses.map((w) => (
                  <span key={w} className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-red-600 italic">Aucun point de vigilance majeur — continue comme ça !</p>
            )}
          </div>
        </div>

        {/* Bases Fragiles alerts */}
        {basesFragiles.length > 0 && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Bases Fragiles détectées
            </h3>
            <div className="space-y-1">
              {basesFragiles.map((bf, i) => (
                <p key={i} className="text-xs text-amber-700 leading-relaxed">
                  • {bf.message}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* NSI Error Breakdown */}
      {nsiErrors && nsiErrors.totalErrors > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:shadow-none print:border-slate-300">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-600" />
            Analyse des erreurs NSI
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-100">
              <Bug className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-yellow-700">{nsiErrors.syntaxErrors}</p>
              <p className="text-[10px] text-yellow-600 uppercase font-medium">Syntaxe</p>
              <p className="text-[10px] text-yellow-500 mt-1">Erreurs de forme</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
              <AlertTriangle className="w-5 h-5 text-orange-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-orange-700">{nsiErrors.logicErrors}</p>
              <p className="text-[10px] text-orange-600 uppercase font-medium">Logique</p>
              <p className="text-[10px] text-orange-500 mt-1">Erreurs d&apos;algo</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
              <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-red-700">{nsiErrors.conceptualErrors}</p>
              <p className="text-[10px] text-red-600 uppercase font-medium">Conceptuel</p>
              <p className="text-[10px] text-red-500 mt-1">Notions à revoir</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Category Breakdown — Maths */}
      {mathsCategories.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:shadow-none print:border-slate-300">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Détail par domaine — Mathématiques</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mathsCategories.map((cat) => (
              <CategoryCard key={cat.category} cat={cat} />
            ))}
          </div>
        </div>
      )}

      {/* Detailed Category Breakdown — NSI */}
      {nsiCategories.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:shadow-none print:border-slate-300">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Détail par domaine — NSI</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nsiCategories.map((cat) => (
              <CategoryCard key={cat.category} cat={cat} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
