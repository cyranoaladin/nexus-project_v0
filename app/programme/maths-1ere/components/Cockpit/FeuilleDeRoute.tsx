'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, Calendar, BookOpen, FileText, Award, ChevronRight } from 'lucide-react';
import { STAGE_PRINTEMPS_2026, getStagePhase, formatDateFr } from '../../config/stage';

type StagePhase = 'avant' | 'pendant' | 'apres';

interface FeuilleDeRouteProps {
  onNavigate: (tab: string) => void;
}

export const FeuilleDeRoute: React.FC<FeuilleDeRouteProps> = ({ onNavigate }) => {
  const phase = getStagePhase();

  const phases: {
    id: StagePhase;
    label: string;
    periode: string;
    couleur: string;
    couleurFond: string;
    couleurBord: string;
    etapes: { label: string; done: boolean; action?: () => void; actionLabel?: string }[];
  }[] = [
    {
      id: 'avant',
      label: 'Avant le stage',
      periode: 'Avant le 20 avril',
      couleur: 'text-blue-400',
      couleurFond: 'bg-blue-500/10',
      couleurBord: 'border-blue-500/30',
      etapes: [
        { label: 'Faire le diagnostic de positionnement', done: phase !== 'avant' },
        { label: 'Identifier mes 3 priorités personnelles', done: phase !== 'avant' },
        { label: 'Réviser les automatismes (6 pts)', done: phase !== 'avant' },
        { label: 'Mémoriser les formules clés', done: phase !== 'avant' },
      ],
    },
    {
      id: 'pendant',
      label: 'Pendant le stage',
      periode: '20 avril – 1er mai',
      couleur: 'text-cyan-400',
      couleurFond: 'bg-cyan-500/10',
      couleurBord: 'border-cyan-500/30',
      etapes: STAGE_PRINTEMPS_2026.seances.map((s) => ({
        label: `${formatDateFr(s.date).split(' ').slice(0, 2).join(' ')} — ${s.theme}`,
        done: new Date(s.date + 'T23:59:59') < new Date(),
      })),
    },
    {
      id: 'apres',
      label: 'Après le stage',
      periode: 'Mai – Juin 2026',
      couleur: 'text-violet-400',
      couleurFond: 'bg-violet-500/10',
      couleurBord: 'border-violet-500/30',
      etapes: [
        { label: 'Appliquer le plan de révision personnalisé', done: false },
        { label: 'Refaire une épreuve blanche en autonomie', done: false },
        { label: 'Consolider les lacunes identifiées en stage', done: false },
        { label: 'Révision finale — 48h avant l\'épreuve', done: false },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-800" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Feuille de route</h2>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      {/* Timeline phases */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-8 bottom-8 w-px bg-slate-800 hidden md:block" />

        <div className="space-y-4">
          {phases.map((p, phaseIdx) => {
            const isCurrentPhase = p.id === phase;
            const isPastPhase = (p.id === 'avant' && phase !== 'avant') || (p.id === 'pendant' && phase === 'apres');
            const doneCount = p.etapes.filter((e) => e.done).length;

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: phaseIdx * 0.1 }}
                className={`rounded-2xl border p-5 transition-all ${
                  isCurrentPhase
                    ? `${p.couleurFond} ${p.couleurBord} shadow-lg`
                    : 'border-slate-800/60 bg-slate-900/30'
                }`}
              >
                {/* Phase header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        isCurrentPhase ? p.couleurFond : 'bg-slate-800'
                      } border ${isCurrentPhase ? p.couleurBord : 'border-slate-700'}`}
                    >
                      <PhaseIcon phase={p.id} active={isCurrentPhase} color={p.couleur} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-sm ${isCurrentPhase ? 'text-white' : 'text-slate-400'}`}>
                          {p.label}
                        </h3>
                        {isCurrentPhase && (
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${p.couleurFond} ${p.couleur} border ${p.couleurBord}`}>
                            En cours
                          </span>
                        )}
                        {isPastPhase && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-500 border border-slate-700">
                            Terminé
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {p.periode}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${isCurrentPhase ? p.couleur : 'text-slate-600'}`}>
                      {doneCount}/{p.etapes.length}
                    </div>
                    <div className="text-[10px] text-slate-600">étapes</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-slate-800 rounded-full mb-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isCurrentPhase
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                        : isPastPhase
                        ? 'bg-green-600'
                        : 'bg-slate-700'
                    }`}
                    style={{ width: `${p.etapes.length > 0 ? (doneCount / p.etapes.length) * 100 : 0}%` }}
                  />
                </div>

                {/* Etapes list */}
                <div className={`space-y-2 ${!isCurrentPhase && 'opacity-60'}`}>
                  {p.etapes.map((etape: any, i: number) => (
                    <div key={i} className="flex items-start gap-2.5">
                      {etape.done ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-xs ${
                          etape.done ? 'text-slate-500 line-through' : isCurrentPhase ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {etape.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA for current phase */}
                {isCurrentPhase && p.id === 'avant' && (
                  <button
                    onClick={() => onNavigate('cours')}
                    className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Démarrer la préparation <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {isCurrentPhase && p.id === 'pendant' && (
                  <button
                    onClick={() => onNavigate('examen')}
                    className="mt-4 flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Accéder à l&apos;épreuve blanche <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {isCurrentPhase && p.id === 'apres' && (
                  <button
                    onClick={() => onNavigate('bilan')}
                    className="mt-4 flex items-center gap-2 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Voir mon plan de révision final <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Promesses Nexus */}
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/30 p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-cyan-400" />
          Ce que Nexus s&apos;engage à vous fournir
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STAGE_PRINTEMPS_2026.promessesNexus.map((promesse: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-500 shrink-0 mt-0.5" />
              <span className="text-xs text-slate-400">{promesse}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function PhaseIcon({ phase, active, color }: { phase: StagePhase; active: boolean; color: string }) {
  const cls = `h-5 w-5 ${active ? color : 'text-slate-600'}`;
  if (phase === 'avant') return <BookOpen className={cls} />;
  if (phase === 'pendant') return <Clock className={cls} />;
  return <FileText className={cls} />;
}
