'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BookOpen, AlertCircle, CheckCircle, Lightbulb, ChevronRight, Loader2 } from 'lucide-react';

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

interface RAGRemediationProps {
  chapId: string;
  chapTitre: string;
  compact?: boolean;
}

export const RAGRemediation: React.FC<RAGRemediationProps> = ({ chapId, chapTitre, compact }) => {
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<RAGHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRemediation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/programme/maths-1ere/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chapId, 
          chapTitre,
          query: `Donne moi des conseils de rédaction, des erreurs classiques et des rappels de cours sur le thème : ${chapTitre}`
        }),
      });

      if (!response.ok) throw new Error('Erreur RAG');
      const data = await response.json();
      setHits(data.hits || []);
    } catch (err) {
      setError("Le service de remédiation est temporairement indisponible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 overflow-hidden relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-violet-500/20 p-2 rounded-xl">
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">Assistant de Remédiation Nexus</h3>
            <p className="text-xs text-slate-400">Intelligence Pédagogique augmentée</p>
          </div>
        </div>
        <button
          onClick={fetchRemediation}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
          Consulter les ressources
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 flex flex-col items-center justify-center text-center"
          >
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin mb-4" />
            <p className="text-sm text-slate-400">Analyse de la collection ressources_pedagogiques_premiere_maths...</p>
          </motion.div>
        ) : hits.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {hits.map((hit, idx) => (
              <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BadgeType type={hit.metadata.type} />
                  <span className="text-xs font-bold text-white">{hit.metadata.title}</span>
                </div>
                <div className="text-sm text-slate-300 leading-relaxed font-serif italic">
                  "{hit.document.length > 300 ? hit.document.slice(0, 300) + '...' : hit.document}"
                </div>
              </div>
            ))}
          </motion.div>
        ) : error ? (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <BookOpen className="h-8 w-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Clique sur "Consulter" pour obtenir des rappels ciblés sur {chapTitre}.</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function BadgeType({ type }: { type?: string }) {
  switch (type) {
    case 'methode':
      return <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-tighter">Méthode</span>;
    case 'erreur_classique':
      return <span className="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-tighter">Vigilance</span>;
    case 'cours':
      return <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-tighter">Rappel</span>;
    default:
      return <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-tighter">Ressource</span>;
  }
}
