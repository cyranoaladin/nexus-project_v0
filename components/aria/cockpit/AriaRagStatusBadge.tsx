import React from 'react';
import { Sparkles, Database } from 'lucide-react';

interface AriaRagStatusBadgeProps {
  hasRagCorpus: boolean;
  ragCollection?: string | null;
  className?: string;
}

export const AriaRagStatusBadge: React.FC<AriaRagStatusBadgeProps> = ({
  hasRagCorpus,
  ragCollection,
  className = '',
}) => {
  if (hasRagCorpus && ragCollection) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}
        title={`Corpus officiel actif : ${ragCollection}`}
      >
        <Sparkles className="w-3 h-3 text-emerald-400" />
        <span>Corpus officiel actif</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/60 text-slate-400 border border-slate-700/40 ${className}`}
      title="Accompagnement pédagogique par méthode et compétences, sans corpus documentaire dédié."
    >
      <Database className="w-3 h-3 text-slate-400" />
      <span>Guidage méthodologique</span>
    </span>
  );
};
