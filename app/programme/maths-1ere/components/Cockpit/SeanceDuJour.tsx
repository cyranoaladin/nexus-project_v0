'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Calendar, BookOpen, Target, ChevronRight } from 'lucide-react';
import { getTodaySession, formatDateFr } from '../../config/stage';

interface SeanceDuJourProps {
  onNavigateToChap: (catKey: string, chapId: string) => void;
}

export const SeanceDuJour: React.FC<SeanceDuJourProps> = ({ onNavigateToChap }) => {
  const session = getTodaySession();

  if (!session) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-800" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-500">Séance du jour</h2>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 to-slate-950 p-6 shadow-2xl shadow-cyan-950/20"
      >
        {/* Background Sparkles Simulation */}
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-blue-500/5 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-[10px] font-black text-cyan-400 border border-cyan-500/30 uppercase tracking-widest">
                Stage Printemps 2026
              </span>
              <span className="text-[10px] text-slate-500 font-bold uppercase">
                {formatDateFr(session.date)}
              </span>
            </div>
            
            <h3 className="text-2xl font-black text-white mb-2 leading-tight">
              {session.theme}
            </h3>
            
            <p className="text-sm text-slate-400 mb-6 max-w-xl leading-relaxed">
              {session.objectifs[0] || 'Aujourd\'hui, nous nous concentrons sur les fondamentaux et les méthodes de rédaction pour l\'épreuve.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-900/60 p-3 border border-white/5">
                  <div className="rounded-lg bg-amber-500/10 p-1.5 shrink-0">
                    <Target className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Durée & Format</div>
                    <div className="text-xs text-slate-300 font-medium">{session.duree}h — {session.format.toUpperCase()}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-900/60 p-3 border border-white/5">
                  <div className="rounded-lg bg-violet-500/10 p-1.5 shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Compétences ciblées</div>
                    <div className="text-xs text-slate-300 font-medium">{session.competences.join(', ')}</div>
                  </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {session.objectifs.map((obj, i) => (
                <span key={i} className="rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 border border-slate-700">
                   ✓ {obj}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex flex-col gap-3">
            <button 
              onClick={() => {
                if (session.chapitresClés.length > 0) {
                   onNavigateToChap('algebre', session.chapitresClés[0]);
                }
              }}
              className="group flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-cyan-600/20 hover:brightness-110 transition-all active:scale-95"
            >
              <BookOpen className="h-5 w-5" />
              LANCER LA SÉANCE
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
