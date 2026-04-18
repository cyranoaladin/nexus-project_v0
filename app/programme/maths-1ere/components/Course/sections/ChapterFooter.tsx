'use client';

import React from 'react';
import { 
  RefreshCw, 
  ExternalLink
} from 'lucide-react';
import { type Chapitre } from '../../../data';
import { type SRSQuality } from '../../../store';
import RAGSources from '../../RAGSources';

interface ChapterFooterProps {
  chapId: string;
  chap: Chapitre;
  onRecordSRSReview: (quality: SRSQuality) => void;
}

export const ChapterFooter: React.FC<ChapterFooterProps> = ({
  chapId,
  chap,
  onRecordSRSReview
}) => {
  return (
    <div className="space-y-10">
      <footer className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-white flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-cyan-400" />
              Révision espacée
            </h4>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              SRS Memory Engine
            </span>
          </div>
          <div className="flex gap-2">
            <SRSButton quality={2} label="Difficile" onClick={() => onRecordSRSReview(2)} />
            <SRSButton quality={3} label="Moyen" onClick={() => onRecordSRSReview(3)} />
            <SRSButton quality={5} label="Facile" onClick={() => onRecordSRSReview(5)} />
          </div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 shadow-sm">
          <RAGSources chapId={chapId} chapTitre={chap.titre} />
        </div>
      </footer>

      {/* External Resources */}
      {chap.ressourcesExt && chap.ressourcesExt.length > 0 && (
        <div className="pt-6 border-t border-slate-700/30">
          <h4 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">Ressources recommandées</h4>
          <div className="flex flex-wrap gap-4">
            {chap.ressourcesExt.map((res, i) => (
              <a 
                key={i} 
                href={res.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {res.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SRSButton = ({ quality, label, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
      quality === 2 ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' :
      quality === 3 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' :
      'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
    }`}
  >
    {label}
  </button>
);
