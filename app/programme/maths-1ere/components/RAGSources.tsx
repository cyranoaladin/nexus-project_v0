'use client';

import { useState, useCallback } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Database, Loader2, Sparkles, X } from 'lucide-react';

interface RAGHit {
  id: string;
  document: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface RAGSourcesProps {
  chapId: string;
  chapTitre: string;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; hits: RAGHit[]; source: 'chroma' | 'pgvector' | 'none' }
  | { status: 'error'; message: string };

const SOURCE_LABEL: Record<string, string> = {
  chroma:   'ChromaDB',
  pgvector: 'pgvector',
  none:     '—',
};

const SOURCE_COLOR: Record<string, string> = {
  chroma:   'text-violet-400 border-violet-500/30 bg-violet-500/10',
  pgvector: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  none:     'text-slate-500 border-slate-600/30 bg-slate-700/10',
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
    score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                  'text-slate-400 bg-slate-500/10 border-slate-500/30';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {score}%
    </span>
  );
}

function HitCard({ hit }: { hit: RAGHit }) {
  const [expanded, setExpanded] = useState(false);
  const title = (hit.metadata?.title as string) ?? (hit.metadata?.source as string) ?? 'Source pédagogique';
  const type  = (hit.metadata?.type as string) ?? '';
  const preview = hit.document.slice(0, 200).trim();
  const hasMore = hit.document.length > 200;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <ScoreBadge score={hit.score} />
            {type && (
              <span className="text-[10px] uppercase tracking-wider text-slate-500">{type}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white truncate">{title}</p>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {expanded ? hit.document : preview}
        {!expanded && hasMore && <span className="text-slate-500">…</span>}
      </p>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {expanded
            ? <><ChevronUp className="h-3 w-3" />Réduire</>
            : <><ChevronDown className="h-3 w-3" />Lire plus</>}
        </button>
      )}
    </div>
  );
}

export default function RAGSources({ chapId, chapTitre }: RAGSourcesProps) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [userQuery, setUserQuery] = useState('');

  const search = useCallback(async (query?: string) => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/programme/maths-1ere/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapId, chapTitre, query: query || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        hits: RAGHit[];
        source: 'chroma' | 'pgvector' | 'none';
      };
      setState({ status: 'done', hits: data.hits, source: data.source });
    } catch (e) {
      setState({ status: 'error', message: (e as Error).message });
    }
  }, [chapId, chapTitre]);

  const reset = () => {
    setState({ status: 'idle' });
    setUserQuery('');
  };

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-4 w-4 text-violet-400" aria-hidden="true" />
        <h3 className="font-bold text-violet-300 text-sm">Sources Nexus — Base de connaissances</h3>
        <Sparkles className="h-3.5 w-3.5 text-violet-400/60" aria-hidden="true" />
      </div>

      {state.status === 'idle' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Interrogez la base documentaire Nexus Réussite pour enrichir ce chapitre avec des extraits pédagogiques vérifiés.
          </p>
          <div className="flex gap-2">
            <input
              value={userQuery}
              onChange={e => setUserQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(userQuery || undefined)}
              placeholder={`Ex : exercices corrigés ${chapTitre}, définition, méthode…`}
              className="flex-1 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
            />
            <button
              onClick={() => search(userQuery || undefined)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-600 transition-colors"
            >
              <Database className="h-3.5 w-3.5" />
              Rechercher
            </button>
          </div>
          <button
            onClick={() => search()}
            className="text-[11px] text-slate-500 hover:text-violet-400 transition-colors underline underline-offset-2"
          >
            Recherche automatique sur «&nbsp;{chapTitre}&nbsp;»
          </button>
        </div>
      )}

      {state.status === 'loading' && (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          Interrogation de la base de connaissances…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <span>Erreur : {state.message}</span>
          <button onClick={reset} className="ml-3 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {state.status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {state.hits.length > 0 ? (
                <>
                  <span className="text-xs text-slate-300">
                    <span className="font-semibold text-white">{state.hits.length}</span> source{state.hits.length > 1 ? 's' : ''} trouvée{state.hits.length > 1 ? 's' : ''}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${SOURCE_COLOR[state.source]}`}>
                    {SOURCE_LABEL[state.source]}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Aucune source trouvée pour ce chapitre dans la base documentaire.
                </span>
              )}
            </div>
            <button onClick={reset} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
              <X className="h-3 w-3" />Réinitialiser
            </button>
          </div>

          {state.hits.length > 0 && (
            <div className="space-y-2">
              {state.hits.map((hit) => (
                <HitCard key={hit.id} hit={hit} />
              ))}
            </div>
          )}

          <button
            onClick={() => search(userQuery || undefined)}
            className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1 mt-1"
          >
            <Database className="h-3 w-3" />
            Relancer la recherche
          </button>
        </div>
      )}
    </div>
  );
}
