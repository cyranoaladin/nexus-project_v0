'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Printer, 
  Maximize2, 
  PanelLeft, 
  Check, 
  Search,
  Puzzle,
  BarChart3,
  Brain,
  Calculator,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { type Chapitre, type Categorie, type CompetenceBO } from '../../../data';

interface ChapterHeaderProps {
  cat: Categorie;
  chap: Chapitre;
  isCompleted: boolean;
  focusMode: boolean;
  onPrint: () => void;
  onToggleFocus: () => void;
  onToggleComplete: () => void;
}

export const ChapterHeader: React.FC<ChapterHeaderProps> = ({
  cat,
  chap,
  isCompleted,
  focusMode,
  onPrint,
  onToggleFocus,
  onToggleComplete
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start mb-10 relative z-10 gap-6">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
            cat.couleur === 'cyan' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
            cat.couleur === 'blue' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
            cat.couleur === 'purple' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
            cat.couleur === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            'bg-green-500/10 text-green-400 border-green-500/20'
          }`}>
            {cat.titre}
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-700/50 text-slate-300 uppercase tracking-widest border border-slate-600/30">
            Difficulté {chap.difficulte}/5
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 uppercase tracking-widest border border-cyan-500/30">
            {chap.pointsXP} XP
          </span>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight leading-tight">
          {chap.titre}
        </h2>

        {/* Competencies */}
        {chap.competences && chap.competences.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chap.competences.map((c) => (
              <CompetenceBadge key={c} type={c} />
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 w-full md:w-auto">
        <button
          onClick={onPrint}
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30 print:hidden"
        >
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
        <button 
          onClick={onToggleFocus} 
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30"
        >
          {focusMode ? <PanelLeft className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {focusMode ? 'Normal' : 'Focus'}
        </button>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={isCompleted ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.3 }}
          onClick={onToggleComplete} 
          className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg ${
            isCompleted 
            ? 'bg-green-500 text-white shadow-green-500/20' 
            : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-600/20'
          }`}
        >
          {isCompleted ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="h-4 w-4" /></motion.div> : null}
          {isCompleted ? 'Maîtrisé' : 'Terminer'}
        </motion.button>
      </div>
    </div>
  );
};

const CompetenceBadge = ({ type }: { type: CompetenceBO }) => {
  const config: Record<string, { label: string; icon: any; color: string }> = {
    chercher: { label: 'Chercher', icon: Search, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    modeliser: { label: 'Modéliser', icon: Puzzle, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    representer: { label: 'Représenter', icon: BarChart3, color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    raisonner: { label: 'Raisonner', icon: Brain, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    calculer: { label: 'Calculer', icon: Calculator, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    communiquer: { label: 'Communiquer', icon: MessageSquare, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  };
  const { label, icon: Icon, color } = config[type] || { label: type, icon: Sparkles, color: 'bg-slate-500/10 text-slate-400' };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${color} uppercase tracking-wide`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};
