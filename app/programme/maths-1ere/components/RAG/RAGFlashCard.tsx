'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { useMathsLabStore } from '../../store';
import { programmeData } from '../../data';
import { MathRichText } from '../MathContent';

interface RAGHit {
  id: string;
  document: string;
  score: number;
  metadata: {
    title?: string;
    type?: 'methode' | 'cours' | 'erreur_classique' | 'exemple';
    theme?: string;
  };
}

type FlashState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; hit: RAGHit }
  | { status: 'empty' }
  | { status: 'error' };

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  methode:         { label: 'Méthode',       className: 'bg-cyan-500/20 text-cyan-400' },
  erreur_classique: { label: 'Vigilance',     className: 'bg-red-500/20 text-red-400' },
  cours:           { label: 'Rappel',         className: 'bg-blue-500/20 text-blue-400' },
  exemple:         { label: 'Exemple',        className: 'bg-emerald-500/20 text-emerald-400' },
};

function getTypeConfig(type?: string) {
  return type && TYPE_CONFIG[type]
    ? TYPE_CONFIG[type]
    : { label: 'Ressource', className: 'bg-slate-800 text-slate-400' };
}

/** Find the chapter title in programmeData given a chapId. */
function resolveChapTitle(chapId: string): string {
  for (const cat of Object.values(programmeData)) {
    const chap = cat.chapitres.find((c) => c.id === chapId);
    if (chap) return chap.titre;
  }
  return chapId.replace(/-/g, ' ');
}

/**
 * Returns the most pedagogically relevant chapter to fetch a RAG flash for:
 *   1. Weakest diagnosed chapter (lowest diagnostic score)
 *   2. First SRS due review
 *   3. Fallback: "second-degre"
 */
function getTargetChapter(
  diagnosticResults: Record<string, { score: number; total: number }>,
  dueReviews: string[],
): { chapId: string; chapTitre: string } {
  const weak = Object.entries(diagnosticResults)
    .filter(([, r]) => r.total > 0)
    .map(([chapId, r]) => ({ chapId, percent: r.score / r.total }))
    .sort((a, b) => a.percent - b.percent);

  if (weak.length > 0) {
    const { chapId } = weak[0];
    return { chapId, chapTitre: resolveChapTitle(chapId) };
  }

  if (dueReviews.length > 0) {
    const chapId = dueReviews[0];
    return { chapId, chapTitre: resolveChapTitle(chapId) };
  }

  return { chapId: 'second-degre', chapTitre: 'Second Degré' };
}

interface RAGFlashCardProps {
  /** Called when the user clicks "Voir d'autres conseils" */
  onShowMore: () => void;
}

/**
 * RAGFlashCard — Cockpit widget that auto-fetches a single contextual RAG tip
 * from the student's weakest diagnosed chapter.
 *
 * Replaces the former hardcoded static "Rappel Méthode IA" block.
 */
export const RAGFlashCard: React.FC<RAGFlashCardProps> = ({ onShowMore }) => {
  const store = useMathsLabStore();
  const [state, setState] = useState<FlashState>({ status: 'idle' });
  const [context, setContext] = useState<{ chapId: string; chapTitre: string } | null>(null);

  const fetch = useCallback(async (chapId: string, chapTitre: string) => {
    setState({ status: 'loading' });
    try {
      const res = await window.fetch('/api/programme/maths-1ere/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapId,
          chapTitre,
          query: `Point de vigilance méthode erreur classique rédaction justification ${chapTitre} épreuve anticipée`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { hits: RAGHit[] };
      const hit = data.hits?.[0];
      setState(hit ? { status: 'done', hit } : { status: 'empty' });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    const dueReviews = store.getDueReviews();
    const target = getTargetChapter(store.diagnosticResults, dueReviews);
    setContext(target);
    fetch(target.chapId, target.chapTitre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    if (context) fetch(context.chapId, context.chapTitre);
  };

  return (
    <div className="rounded-3xl border border-violet-500/30 bg-violet-950/20 p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-violet-500/20 p-2 shrink-0">
          <Sparkles className="h-4 w-4 text-violet-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm leading-tight">Rappel Méthode IA</h3>
          {context && (
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{context.chapTitre}</p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={state.status === 'loading'}
          className="shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
          aria-label="Rafraîchir le rappel"
          title="Rafraîchir"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 text-slate-400 ${state.status === 'loading' ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Context label */}
      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
        Basé sur ton chapitre le plus fragile, voici un point de vigilance pour l&apos;épreuve :
      </p>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {state.status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-6 flex flex-col items-center gap-2"
          >
            <Loader2 className="h-5 w-5 text-violet-400 animate-spin" aria-hidden="true" />
            <p className="text-[10px] text-slate-500">Analyse des ressources pédagogiques…</p>
          </motion.div>
        )}

        {state.status === 'done' && (() => {
          const { hit } = state;
          const badge = getTypeConfig(hit.metadata.type);
          const preview = hit.document.length > 300
            ? hit.document.slice(0, 300) + '…'
            : hit.document;

          return (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span
                className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter mb-2 ${badge.className}`}
              >
                {badge.label}
              </span>
              <div className="rounded-2xl bg-slate-900/60 p-4 border border-white/5">
                <MathRichText content={preview} className="text-xs text-slate-300 leading-relaxed" />
              </div>
            </motion.div>
          );
        })()}

        {state.status === 'empty' && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-4 flex flex-col items-center gap-2 text-center"
          >
            <BookOpen className="h-5 w-5 text-slate-700" aria-hidden="true" />
            <p className="text-[10px] text-slate-500">
              Aucune ressource trouvée pour ce chapitre.
            </p>
          </motion.div>
        )}

        {state.status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-4 flex flex-col items-center gap-2 text-center"
          >
            <AlertCircle className="h-5 w-5 text-red-500/60" aria-hidden="true" />
            <p className="text-[10px] text-slate-500">
              Service temporairement indisponible.
            </p>
          </motion.div>
        )}

        {state.status === 'idle' && (
          <motion.div key="idle" className="py-2">
            <p className="text-[10px] text-slate-500 text-center">Chargement…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA */}
      <button
        onClick={onShowMore}
        className="mt-4 w-full rounded-xl bg-violet-600/20 py-2.5 text-xs font-bold text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 transition-all"
      >
        Voir d&apos;autres conseils
      </button>
    </div>
  );
};
