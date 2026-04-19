'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Timer,
  BookOpen,
  RotateCcw,
  Trophy,
  Info,
  Lightbulb,
} from 'lucide-react';
import { EPREUVE_MATHS_1ERE, SUJET_BLANC_1 } from '../../config/exam';
import { MathRichText } from '../MathContent';
import { RAGRemediation } from '../RAG/RAGRemediation';

type ExamMode = 'accueil' | 'automatismes' | 'exercices' | 'correction';
type AutomatismeState = Record<string, { reponse: string; revealed: boolean }>;

export const ExamenBlancView: React.FC = () => {
  const [mode, setMode] = useState<ExamMode>('accueil');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [autoStates, setAutoStates] = useState<AutomatismeState>({});
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = EPREUVE_MATHS_1ERE.dureeMinutes * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const timeUp = elapsedSeconds >= totalSeconds;

  useEffect(() => {
    if (isTimerRunning && !timeUp) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerRunning, timeUp]);

  const startExam = useCallback(() => {
    setElapsedSeconds(0);
    setAutoStates({});
    setIsTimerRunning(true);
    setMode('automatismes');
  }, []);

  const resetExam = useCallback(() => {
    setIsTimerRunning(false);
    setElapsedSeconds(0);
    setAutoStates({});
    setMode('accueil');
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timerColor =
    remainingSeconds < 600 ? 'text-red-400' :
    remainingSeconds < 1800 ? 'text-amber-400' :
    'text-cyan-400';

  const revealedCount = Object.values(autoStates).filter((s) => s.revealed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-slate-700/40 bg-slate-900/60 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Épreuve Anticipée</span>
            </div>
            <h1 className="text-2xl font-black text-white">Blanc — Format Officiel 2026</h1>
            <p className="text-sm text-slate-400 mt-1">
              2 heures · Sans calculatrice · 6 pts automatismes + 14 pts exercices
            </p>
          </div>

          {mode !== 'accueil' && (
            <div className="flex flex-col items-end gap-2">
              <div className={`font-mono text-4xl font-black ${timerColor} tabular-nums`}>
                {formatTime(remainingSeconds)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTimerRunning((v) => !v)}
                  className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  {isTimerRunning ? 'Pause' : 'Reprendre'}
                </button>
                {timeUp && (
                  <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-1 text-xs font-bold text-red-400">
                    Temps écoulé !
                  </span>
                )}
              </div>
              {/* Progress bar */}
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    remainingSeconds < 600 ? 'bg-red-500' :
                    remainingSeconds < 1800 ? 'bg-amber-500' :
                    'bg-cyan-500'
                  }`}
                  style={{ width: `${(remainingSeconds / totalSeconds) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mode: Accueil */}
      {mode === 'accueil' && (
        <AccueilExamen onStart={startExam} />
      )}

      {/* Mode: Automatismes */}
      {(mode === 'automatismes' || mode === 'exercices' || mode === 'correction') && (
        <>
          {/* Navigation entre parties */}
          <div className="flex gap-2">
            {[
              { id: 'automatismes' as ExamMode, label: 'Automatismes (6 pts)', nb: revealedCount },
              { id: 'exercices' as ExamMode, label: 'Exercices (14 pts)', nb: null },
              { id: 'correction' as ExamMode, label: 'Correction complète', nb: null },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`flex-1 rounded-2xl px-4 py-3 text-xs font-bold transition-all border ${
                  mode === tab.id
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    : 'bg-slate-900/40 border-slate-700/40 text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
                {tab.nb !== null && tab.nb > 0 && (
                  <span className="ml-2 rounded-full bg-cyan-500/20 px-1.5 text-[9px]">{tab.nb}/6</span>
                )}
              </button>
            ))}
          </div>

          {/* Stratégie rappel */}
          <StrategieCard partie={mode === 'automatismes' ? 'automatismes' : 'exercices'} />
        </>
      )}

      {/* Automatismes */}
      {mode === 'automatismes' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/20 p-2">
              <Timer className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Partie 1 — Automatismes</h2>
              <p className="text-xs text-slate-400">Objectif : 6 questions en ~20 minutes. Réponse directe, pas de rédaction.</p>
            </div>
          </div>

          <div className="space-y-3">
            {SUJET_BLANC_1.automatismes.map((q: any, i: number) => {
              const state = autoStates[q.id] ?? { reponse: '', revealed: false };
              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-5 transition-all ${
                    state.revealed
                      ? 'border-green-500/20 bg-green-500/5'
                      : 'border-slate-700/40 bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black shrink-0 ${
                        state.revealed
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{q.theme}</span>
                      </div>
                      <div className="text-sm text-slate-200 mb-3">
                        <MathRichText content={q.enonce} />
                      </div>

                      {state.revealed ? (
                        <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                            <span className="text-xs font-bold text-green-400">Réponse</span>
                          </div>
                          <p className="text-sm text-green-300 font-mono">{q.reponse}</p>
                          {q.astuce && (
                            <p className="text-xs text-slate-400 mt-1 flex items-start gap-1.5">
                              <Lightbulb className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
                              {q.astuce}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={state.reponse}
                            onChange={(e) =>
                              setAutoStates((prev) => ({
                                ...prev,
                                [q.id]: { ...state, reponse: e.target.value },
                              }))
                            }
                            placeholder="Ta réponse..."
                            className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none transition-all"
                          />
                          <button
                            onClick={() =>
                              setAutoStates((prev) => ({
                                ...prev,
                                [q.id]: { ...state, revealed: true },
                              }))
                            }
                            className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:border-cyan-500/50 transition-all"
                          >
                            Voir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {revealedCount === SUJET_BLANC_1.automatismes.length && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setMode('exercices')}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 py-4 font-bold text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-600/20"
            >
              Passer aux exercices →
            </motion.button>
          )}
        </div>
      )}

      {/* Exercices */}
      {mode === 'exercices' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-500/20 p-2">
              <BookOpen className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Partie 2 — Exercices avec rédaction</h2>
              <p className="text-xs text-slate-400">Objectif : ~90 minutes. Rédiger intégralement avec justifications.</p>
            </div>
          </div>

          {SUJET_BLANC_1.exercices.map((ex: any) => (
            <div key={ex.id} className="rounded-2xl border border-slate-700/40 bg-slate-900/40 overflow-hidden">
              <button
                onClick={() => setExpandedEx(expandedEx === ex.id ? null : ex.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/30 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Exercice · {ex.totalPoints} pts</span>
                    <span className="text-[10px] text-slate-600">~{ex.dureeEstimee} min</span>
                  </div>
                  <h3 className="font-bold text-white">{ex.titre}</h3>
                </div>
                {expandedEx === ex.id ? (
                  <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
                )}
              </button>

              <AnimatePresence>
                {expandedEx === ex.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-800">
                      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 mt-4">
                        <p className="text-sm text-slate-300 leading-relaxed">{ex.contexte}</p>
                      </div>

                      {/* Pièges classiques */}
                      {ex.piegesClassiques.length > 0 && (
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-xs font-bold text-amber-400">Pièges à éviter</span>
                          </div>
                          {ex.piegesClassiques.map((piege: string, i: number) => (
                            <div key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                              <span className="text-amber-500 shrink-0">·</span>
                              {piege}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Questions */}
                      <div className="space-y-3">
                        {ex.questions.map((q: any) => (
                          <div
                            key={q.numero}
                            className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs font-bold text-slate-400 shrink-0">
                                {q.numero}
                              </span>
                              <div className="flex-1">
                                <div className="text-sm text-slate-200 mb-2 leading-relaxed">
                                  <MathRichText content={q.enonce} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-500">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                                  {q.competences.map((c: string) => (
                                    <span key={c} className="text-[9px] font-bold rounded px-1.5 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 uppercase">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          <button
            onClick={() => { setIsTimerRunning(false); setMode('correction'); }}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900/40 py-4 font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
          >
            Terminer et voir la correction
          </button>
        </div>
      )}

      {/* Correction */}
      {mode === 'correction' && (
        <CorrectionView onReset={resetExam} elapsedSeconds={elapsedSeconds} />
      )}
    </div>
  );
};

// ─── Accueil Examen ───────────────────────────────────────────────────────────

const AccueilExamen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="space-y-5">
    {/* Format officiel */}
    <div className="rounded-3xl border border-slate-700/40 bg-slate-900/60 p-6">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Info className="h-5 w-5 text-blue-400" />
        Format officiel — Ce qu&apos;il faut savoir
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EPREUVE_MATHS_1ERE.parties.map((p) => (
          <div key={p.id} className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white text-sm">{p.nom}</h3>
              <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-500/30">
                {p.points} pts
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">{p.description}</p>
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Durée recommandée : {p.dureeRecommandee} min
            </div>
            <div className="mt-3 rounded-lg bg-blue-500/5 border border-blue-500/15 p-3">
              <p className="text-xs text-blue-300 leading-relaxed">{p.strategie}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Conseils généraux */}
    <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
      <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        Conseils de méthode
      </h3>
      <div className="space-y-2">
        {EPREUVE_MATHS_1ERE.conseilsGeneraux.map((c: string, i: number) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-cyan-500 text-sm shrink-0 mt-0.5">·</span>
            <p className="text-xs text-slate-300">{c}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Erreurs fréquentes */}
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
      <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        Erreurs fréquentes à éviter
      </h3>
      <div className="space-y-2">
        {EPREUVE_MATHS_1ERE.erreursFréquentes.map((e: string, i: number) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-amber-500 text-sm shrink-0 mt-0.5">!</span>
            <p className="text-xs text-slate-300">{e}</p>
          </div>
        ))}
      </div>
    </div>

    {/* CTA */}
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onStart}
      className="w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 py-5 text-lg font-black text-white shadow-2xl shadow-cyan-600/30 hover:from-cyan-500 hover:to-blue-500 transition-all"
    >
      Démarrer l&apos;épreuve blanche — 2h00
    </motion.button>

    <p className="text-center text-xs text-slate-600">
      Le chronomètre démarre au clic. Sans calculatrice. Dans les conditions de l&apos;épreuve.
    </p>
  </div>
);

// ─── Stratégie Card ───────────────────────────────────────────────────────────

const StrategieCard: React.FC<{ partie: string }> = ({ partie }) => {
  const config = EPREUVE_MATHS_1ERE.parties.find((p) => p.id === partie);
  if (!config) return null;
  return (
    <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 px-4 py-3 flex items-start gap-3">
      <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
      <p className="text-xs text-blue-300 leading-relaxed">{config.strategie}</p>
    </div>
  );
};

// ─── Correction View ──────────────────────────────────────────────────────────

const CorrectionView: React.FC<{ onReset: () => void; elapsedSeconds: number }> = ({ onReset, elapsedSeconds }) => {
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const minutes = Math.floor(elapsedSeconds / 60);

  return (
    <div className="space-y-5">
      {/* Résumé performance */}
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-green-500/20 p-2">
            <Trophy className="h-4 w-4 text-green-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">Correction complète</h2>
            <p className="text-xs text-slate-400">
              Temps utilisé : {minutes > 120 ? (
                <span className="text-red-400 font-bold">{minutes} min (dépassé)</span>
              ) : (
                <span className="text-cyan-400 font-bold">{minutes} min / 120 min</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Correction automatismes */}
      <div>
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <span className="rounded-lg bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400">Partie 1</span>
          Automatismes — Correction
        </h3>
        <div className="space-y-3">
          {SUJET_BLANC_1.automatismes.map((q: any, i: number) => (
            <div key={q.id} className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-xs font-black text-slate-400 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-300 mb-2">{q.enonce.replace(/\\\(|\\\)/g, '')}</div>
                  <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-sm font-bold text-green-300">{q.reponse}</span>
                    </div>
                    {q.astuce && (
                      <p className="text-xs text-slate-400 mt-1">💡 {q.astuce}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Correction exercices */}
      <div>
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <span className="rounded-lg bg-violet-500/20 px-2.5 py-1 text-xs font-bold text-violet-400">Partie 2</span>
          Exercices — Correction détaillée
        </h3>
        <div className="space-y-4">
          {SUJET_BLANC_1.exercices.map((ex: any) => (
            <div key={ex.id} className="rounded-2xl border border-slate-700/40 bg-slate-900/40 overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <h4 className="font-bold text-white">{ex.titre}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{ex.contexte}</p>
              </div>
              <div className="p-5 space-y-3">
                {ex.questions.map((q: any) => (
                  <div key={q.numero} className="rounded-xl border border-slate-700/40 bg-slate-900/60 overflow-hidden">
                    <button
                      onClick={() => setExpandedQ(expandedQ === `${ex.id}-${q.numero}` ? null : `${ex.id}-${q.numero}`)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-bold text-slate-400">
                          {q.numero}
                        </span>
                        <span className="text-sm text-slate-300 line-clamp-1">{q.enonce.replace(/\\\(|\\\)/g, '')}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-500">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                        {expandedQ === `${ex.id}-${q.numero}` ? (
                          <ChevronUp className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedQ === `${ex.id}-${q.numero}` && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-slate-800">
                            <div className="mt-3 space-y-3">
                              {q.solution.map((step: string, i: number) => (
                                <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-900/40 p-3 border border-white/5">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-black text-cyan-400 shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <div className="text-sm text-slate-300 leading-relaxed">
                                    <MathRichText content={step} />
                                  </div>
                                </div>
                              ))}
                              
                              <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Aide Nexus (RAG)</p>
                                <RAGRemediation chapId={ex.id} chapTitre={ex.titre} compact />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/40 py-4 text-sm font-bold text-slate-400 hover:text-white hover:border-slate-600 transition-all"
      >
        <RotateCcw className="h-4 w-4" />
        Recommencer une épreuve blanche
      </button>
    </div>
  );
};
