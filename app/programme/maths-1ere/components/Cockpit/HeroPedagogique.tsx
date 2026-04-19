'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Target, TrendingUp, Zap, AlertTriangle, CheckCircle2, BookOpen } from 'lucide-react';
import {
  getStagePhase,
  getDaysUntilStage,
  getDaysUntilExam,
  getTodaySession,
  getNextSession,
  formatDateFr,
} from '../../config/stage';
import { useMathsLabStore } from '../../store';

interface HeroPedagogiqueProps {
  displayName: string;
  onNavigate: (tab: string) => void;
}

export const HeroPedagogique: React.FC<HeroPedagogiqueProps> = ({ displayName, onNavigate }) => {
  const store = useMathsLabStore();
  const now = new Date();
  const phase = getStagePhase(now);
  const daysUntilStage = getDaysUntilStage(now);
  const daysUntilExam = getDaysUntilExam(now);
  const todaySession = getTodaySession(now);
  const nextSession = getNextSession(now);
  const niveau = store.getNiveau();

  const completedCount = store.completedChapters.length;
  const dueReviews = store.getDueReviews().length;

  const readinessLevel = getReadinessLevel(completedCount, store.totalXP);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-700/40 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 p-8 md:p-10 shadow-2xl">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-900/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Stage phase badge */}
        <StagePhaseBadge phase={phase} />

        {/* Main header */}
        <div className="mt-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
             <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Target className="h-6 w-6 text-white" />
             </div>
             <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                  Cockpit Pédagogique <span className="text-indigo-400">#Epreuve2026</span>
                </h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Stage de Printemps — Maths Première</p>
             </div>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            Ravi de te revoir, {displayName}
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Ta préparation personnalisée pour l'épreuve anticipée de mathématiques. 
            Suis ton plan de révision, maîtrise les automatismes et sécurise tes points sur les exercices de raisonnement.
          </p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <CountdownCard
            value={daysUntilExam}
            label="jours avant l'épreuve"
            sublabel="~16 juin 2026"
            icon={<Calendar className="h-4 w-4" />}
            urgency={daysUntilExam < 30 ? 'high' : daysUntilExam < 60 ? 'medium' : 'low'}
          />
          <CountdownCard
            value={phase === 'avant' ? daysUntilStage : phase === 'pendant' ? 0 : -1}
            label={phase === 'avant' ? 'jours avant le stage' : phase === 'pendant' ? 'Stage en cours' : 'Stage terminé'}
            sublabel={phase === 'avant' ? '20 avril – 1er mai' : phase === 'pendant' ? '14h de maths' : 'Post-stage'}
            icon={<Target className="h-4 w-4" />}
            urgency={phase === 'pendant' ? 'high' : 'medium'}
            isStage
          />
          <CountdownCard
            value={completedCount}
            label="chapitres maîtrisés"
            sublabel="sur le programme"
            icon={<CheckCircle2 className="h-4 w-4" />}
            urgency="low"
          />
          <CountdownCard
            value={dueReviews}
            label="révisions à faire"
            sublabel="recommandées SRS"
            icon={<Zap className="h-4 w-4" />}
            urgency={dueReviews > 3 ? 'high' : dueReviews > 0 ? 'medium' : 'low'}
          />
        </div>

        {/* Today's session or next session */}
        {phase === 'pendant' && todaySession && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-cyan-500/20 p-2.5 shrink-0">
                <Clock className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Séance du jour</span>
                  <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                    {todaySession.duree}h
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-700">
                    {todaySession.format}
                  </span>
                </div>
                <h3 className="font-bold text-white text-lg">{todaySession.theme}</h3>
                <div className="mt-2 space-y-1">
                  {todaySession.objectifs.slice(0, 2).map((obj: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0" />
                      {obj}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => onNavigate('cours')}
                className="shrink-0 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 transition-colors"
              >
                Commencer
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'avant' && nextSession && (
          <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-500/20 p-2.5 shrink-0">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Prochaine séance</span>
                <h3 className="font-bold text-white mt-1">{nextSession.theme}</h3>
                <p className="text-sm text-slate-400 mt-0.5 capitalize">{formatDateFr(nextSession.date)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nextSession.chapitresClés.map((chapId: string) => (
                    <span key={chapId} className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-400 border border-slate-700">
                      {chapId.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Readiness indicator */}
        <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-bold text-white">Niveau de préparation</span>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold border ${
                readinessLevel === 'Bon'
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : readinessLevel === 'Moyen'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              }`}
            >
              {readinessLevel}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                readinessLevel === 'Bon'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                  : readinessLevel === 'Moyen'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  : 'bg-gradient-to-r from-red-600 to-orange-500'
              }`}
              style={{ width: `${getReadinessPercent(completedCount, store.totalXP)}%` }}
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            {dueReviews > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{dueReviews} révision{dueReviews > 1 ? 's' : ''} en retard dans le SRS</span>
              </div>
            )}
            {dueReviews === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Toutes les révisions sont à jour</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StagePhaseBadge({ phase }: { phase: 'avant' | 'pendant' | 'apres' }) {
  const config = {
    avant: { label: 'Pré-stage', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', dot: 'bg-blue-400' },
    pendant: { label: 'Stage en cours', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10', dot: 'bg-cyan-400 animate-pulse' },
    apres: { label: 'Post-stage', color: 'text-violet-400 border-violet-500/30 bg-violet-500/10', dot: 'bg-violet-400' },
  };
  const c = config[phase];
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${c.color}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      Stage Printemps 2026 — {c.label}
    </div>
  );
}

interface CountdownCardProps {
  value: number;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  urgency: 'high' | 'medium' | 'low';
  isStage?: boolean;
}

function CountdownCard({ value, label, sublabel, icon, urgency, isStage }: CountdownCardProps) {
  const color = {
    high: 'text-red-400 border-red-500/20 bg-red-500/5',
    medium: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    low: 'text-slate-300 border-slate-700/40 bg-slate-800/30',
  }[urgency];

  const valueColor = {
    high: 'text-red-400',
    medium: 'text-amber-400',
    low: 'text-white',
  }[urgency];

  const displayValue = value < 0 ? '✓' : value === 0 && isStage ? '•' : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 ${color}`}
    >
      <div className={`flex items-center gap-1.5 mb-2 opacity-70 ${valueColor}`}>
        {icon}
      </div>
      <div className={`text-2xl font-black tracking-tight ${valueColor}`}>
        {displayValue}
      </div>
      <div className="text-xs font-bold text-slate-300 mt-0.5">{label}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sublabel}</div>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getReadinessLevel(completed: number, xp: number): 'Bon' | 'Moyen' | 'Insuffisant' {
  const score = completed * 10 + Math.min(xp / 50, 40);
  if (score >= 60) return 'Bon';
  if (score >= 30) return 'Moyen';
  return 'Insuffisant';
}

function getReadinessPercent(completed: number, xp: number): number {
  const score = completed * 10 + Math.min(xp / 50, 40);
  return Math.min(100, Math.max(5, score));
}
