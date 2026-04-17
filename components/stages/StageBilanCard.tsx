'use client';

import { FileText, Star, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export interface StageBilanData {
  id: string;
  stage?: { title: string; slug: string } | null;
  scoreGlobal?: number | null;
  contentEleve?: string;
  contentParent?: string;
  strengths?: string[];
  areasForGrowth?: string[];
  nextSteps?: string | null;
  pdfUrl?: string | null;
  publishedAt?: Date | string | null;
  studentName?: string;
}

interface StageBilanCardProps {
  bilan: StageBilanData;
  view: 'eleve' | 'parent';
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 20);
  const color = pct >= 14 ? 'text-emerald-400' : pct >= 10 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex flex-col items-center justify-center h-14 w-14 rounded-full border-2 border-current/30 bg-slate-800/60 shrink-0">
      <span className={`text-lg font-bold leading-none ${color}`}>{pct.toFixed(1)}</span>
      <span className="text-[9px] text-slate-500">/20</span>
    </div>
  );
}

export function StageBilanCard({ bilan, view }: StageBilanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const content = view === 'eleve' ? bilan.contentEleve : bilan.contentParent;

  const published = bilan.publishedAt
    ? new Date(bilan.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/8">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">Bilan de stage</p>
          <h3 className="text-white font-semibold text-sm truncate">{bilan.stage?.title ?? '—'}</h3>
          {bilan.studentName && <p className="text-slate-400 text-xs mt-0.5">{bilan.studentName}</p>}
          {published && <p className="text-slate-500 text-xs mt-1">Publié le {published}</p>}
        </div>
        {bilan.scoreGlobal != null && <ScoreRing score={bilan.scoreGlobal} />}
      </div>

      {/* Content */}
      {content && (
        <div className="p-4 border-b border-white/8">
          <p className={`text-slate-300 text-sm leading-relaxed whitespace-pre-wrap ${!expanded ? 'line-clamp-4' : ''}`}>
            {content}
          </p>
          {content.length > 300 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" />Réduire</> : <><ChevronDown className="h-3 w-3" />Lire la suite</>}
            </button>
          )}
        </div>
      )}

      {/* Strengths / Areas */}
      {((bilan.strengths?.length ?? 0) > 0 || (bilan.areasForGrowth?.length ?? 0) > 0) && (
        <div className="grid grid-cols-2 divide-x divide-white/8 border-b border-white/8">
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1">
              <Star className="h-3 w-3" />Points forts
            </p>
            <ul className="space-y-1">
              {bilan.strengths?.slice(0, 3).map((s, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                  <span className="text-emerald-500 mt-0.5">•</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-1.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />Axes de progrès
            </p>
            <ul className="space-y-1">
              {bilan.areasForGrowth?.slice(0, 3).map((a, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                  <span className="text-amber-500 mt-0.5">•</span>{a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Next steps + PDF */}
      {(bilan.nextSteps || bilan.pdfUrl) && (
        <div className="p-4 flex items-start justify-between gap-3">
          {bilan.nextSteps && (
            <p className="text-xs text-slate-400 flex-1">
              <span className="text-slate-300 font-medium">Prochaine étape : </span>
              {bilan.nextSteps}
            </p>
          )}
          {bilan.pdfUrl && (
            <a
              href={bilan.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg px-3 py-1.5 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />PDF
            </a>
          )}
        </div>
      )}
    </div>
  );
}
