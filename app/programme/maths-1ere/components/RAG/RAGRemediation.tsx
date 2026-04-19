'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  BookOpen,
  AlertCircle,
  Lightbulb,
  Loader2,
  ChevronDown,
  ChevronUp,
  Database,
} from 'lucide-react';
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

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  methode:          { label: 'Méthode',     className: 'bg-cyan-500/20 text-cyan-400' },
  erreur_classique: { label: 'Vigilance',   className: 'bg-red-500/20 text-red-400' },
  cours:            { label: 'Rappel',      className: 'bg-blue-500/20 text-blue-400' },
  exemple:          { label: 'Exemple',     className: 'bg-emerald-500/20 text-emerald-400' },
};

function getTypeConfig(type?: string) {
  return type && TYPE_CONFIG[type]
    ? TYPE_CONFIG[type]
    : { label: 'Ressource', className: 'bg-slate-800 text-slate-400' };
}

const SOURCE_CONFIG = {
  chroma:   { label: 'ChromaDB',  className: 'text-violet-400' },
  pgvector: { label: 'pgvector',  className: 'text-blue-400' },
  none:     { label: 'aucune',    className: 'text-slate-500' },
} as const;

// ─── Sub-components ─────────────────────────────────────────────────────────

interface RAGHitCardProps {
  hit: RAGHit;
  index: number;
  mode: 'eleve' | 'enseignant';
}

const RAGHitCard: React.FC<RAGHitCardProps> = ({ hit, index, mode }) => {
  const [expanded, setExpanded] = useState(false);
  const badge = getTypeConfig(hit.metadata.type);
  const isLong = hit.document.length > 400;
  const preview = isLong && !expanded ? hit.document.slice(0, 400) + '…' : hit.document;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${badge.className}`}
          >
            {badge.label}
          </span>
          {hit.metadata.title && (
            <span className="text-xs font-bold text-white">{hit.metadata.title}</span>
          )}
        </div>
        <span className="text-[10px] text-slate-600 shrink-0">
          {hit.score}%
        </span>
      </div>

      {/* Mode enseignant : afficher le contenu complet d'emblée */}
      <MathRichText
        content={mode === 'enseignant' ? hit.document : preview}
        className="text-sm text-slate-300 leading-relaxed"
      />

      {isLong && mode === 'eleve' && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors"
        >
          {expanded
            ? <><ChevronUp className="h-3 w-3" /> Réduire</>
            : <><ChevronDown className="h-3 w-3" /> Lire la suite</>}
        </button>
      )}
    </motion.div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

interface RAGRemediationProps {
  chapId: string;
  chapTitre: string;
  /** If true, triggers the RAG fetch automatically on mount. Default: false. */
  autoLoad?: boolean;
  /** Display mode: 'eleve' shows truncated content; 'enseignant' shows full content. Default: 'eleve'. */
  mode?: 'eleve' | 'enseignant';
  /** Custom query to override the default pedagogical query. */
  customQuery?: string;
  compact?: boolean;
}

export const RAGRemediation: React.FC<RAGRemediationProps> = ({
  chapId,
  chapTitre,
  autoLoad = false,
  mode = 'eleve',
  customQuery,
  compact,
}) => {
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<RAGHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'chroma' | 'pgvector' | 'none' | null>(null);

  const fetchRemediation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query =
        customQuery ??
        (mode === 'enseignant'
          ? `Remédiation enseignant : méthodes, erreurs classiques, conseils de rédaction — ${chapTitre}`
          : `Conseils de rédaction, erreurs classiques, rappels de cours — ${chapTitre}`);

      const response = await fetch('/api/programme/maths-1ere/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapId, chapTitre, query }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setHits(data.hits ?? []);
      setSource(data.source ?? null);
    } catch {
      setError('Le service de remédiation est temporairement indisponible.');
    } finally {
      setLoading(false);
    }
  }, [chapId, chapTitre, mode, customQuery]);

  useEffect(() => {
    if (autoLoad) fetchRemediation();
  }, [autoLoad, fetchRemediation]);

  return (
    <div className={`rounded-2xl border border-violet-500/20 bg-violet-500/5 overflow-hidden ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-violet-500/20 p-2 rounded-xl shrink-0">
            <Sparkles className="h-5 w-5 text-violet-400" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">
              {mode === 'enseignant'
                ? 'Remédiation Enseignant Nexus'
                : 'Assistant de Remédiation Nexus'}
            </h3>
            <p className="text-[10px] text-slate-500">
              {mode === 'enseignant'
                ? 'Intelligence pédagogique augmentée — Vue Enseignant'
                : 'Ressources ciblées par IA pédagogique'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {source && (
            <span
              className={`flex items-center gap-1 text-[10px] font-bold ${SOURCE_CONFIG[source].className}`}
              title={`Source des données : ${SOURCE_CONFIG[source].label}`}
            >
              <Database className="h-3 w-3" aria-hidden="true" />
              {SOURCE_CONFIG[source].label}
            </span>
          )}
          <button
            onClick={fetchRemediation}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition-all disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              : <Lightbulb className="h-3 w-3" aria-hidden="true" />}
            Consulter les ressources
          </button>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 flex flex-col items-center justify-center text-center gap-3"
          >
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" aria-hidden="true" />
            <p className="text-sm text-slate-400">
              Analyse de la collection{' '}
              <code className="text-violet-400 font-mono text-xs">ressources_pedagogiques_premiere_maths</code>…
            </p>
          </motion.div>
        )}

        {!loading && hits.length > 0 && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {hits.map((hit, idx) => (
              <RAGHitCard key={hit.id || idx} hit={hit} index={idx} mode={mode} />
            ))}
          </motion.div>
        )}

        {!loading && hits.length === 0 && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-6"
          >
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {!loading && hits.length === 0 && !error && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-800"
          >
            <BookOpen className="h-8 w-8 text-slate-700 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-slate-500">
              Clique sur &laquo;&nbsp;Consulter&nbsp;&raquo; pour obtenir des rappels ciblés sur{' '}
              <span className="text-slate-400 font-medium">{chapTitre}</span>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
