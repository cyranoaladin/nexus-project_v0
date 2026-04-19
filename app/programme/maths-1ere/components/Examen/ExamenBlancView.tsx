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
import { EPREUVE_MATHS_1ERE, SUJET_BLANC_1, type ExerciceBloc, type QuestionExercice } from '../../config/exam';
import { MathRichText } from '../MathContent';
import { RAGRemediation } from '../RAG/RAGRemediation';

type ExamMode = 'accueil' | 'automatismes' | 'exercices' | 'correction';
type AutomatismeState = Record<string, { reponse: string; revealed: boolean; selfScore?: 0 | 0.5 | 1 }>;
/** Map of "exId-questionNumero" → self-awarded points */
type ExerciceScoreState = Record<string, number>;

export const ExamenBlancView: React.FC = () => {
  const [mode, setMode] = useState<ExamMode>('accueil');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [autoStates, setAutoStates] = useState<AutomatismeState>({});
  const [exScores, setExScores] = useState<ExerciceScoreState>({});
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Computed totals
  const autoTotal = Object.values(autoStates)
    .filter((s) => s.revealed)
    .reduce((sum, s) => sum + (s.selfScore ?? 0), 0);
  const exTotal = Object.values(exScores).reduce((sum, v) => sum + v, 0);
  const grandTotal = Math.round((autoTotal + exTotal) * 10) / 10;

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
            {SUJET_BLANC_1.automatismes.map((q, i) => {
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
                      {q.theme && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{q.theme}</span>
                        </div>
                      )}
                      <div className="text-sm text-slate-200 mb-3">
                        <MathRichText content={q.enonce} />
                      </div>

                      {state.revealed ? (
                        <div className="space-y-2">
                          <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                              <span className="text-xs font-bold text-green-400">Réponse correcte</span>
                            </div>
                            <div className="text-sm text-green-300">
                              <MathRichText content={q.reponse} />
                            </div>
                            {q.astuce && (
                              <p className="text-xs text-slate-400 mt-2 flex items-start gap-1.5">
                                <Lightbulb className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
                                {q.astuce}
                              </p>
                            )}
                          </div>
                          {/* Auto-évaluation */}
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Mon score :</span>
                            {([1, 0.5, 0] as const).map((score) => (
                              <button
                                key={score}
                                onClick={() =>
                                  setAutoStates((prev) => ({
                                    ...prev,
                                    [q.id]: { ...state, selfScore: score },
                                  }))
                                }
                                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold border transition-all ${
                                  state.selfScore === score
                                    ? score === 1
                                      ? 'bg-green-500/30 border-green-500 text-green-300'
                                      : score === 0.5
                                      ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                                      : 'bg-red-500/30 border-red-500 text-red-300'
                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                                }`}
                              >
                                {score === 1 ? '✓ 1 pt' : score === 0.5 ? '½ pt' : '✗ 0 pt'}
                              </button>
                            ))}
                          </div>
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setAutoStates((prev) => ({
                                  ...prev,
                                  [q.id]: { ...state, revealed: true },
                                }));
                              }
                            }}
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
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700 px-5 py-3">
                <span className="text-sm text-slate-400">Score Automatismes (auto-évaluation)</span>
                <span className={`text-lg font-black ${autoTotal >= 5 ? 'text-green-400' : autoTotal >= 3 ? 'text-amber-400' : 'text-red-400'}`}>
                  {autoTotal} / 6 pts
                </span>
              </div>
              <button
                onClick={() => setMode('exercices')}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 py-4 font-bold text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-600/20"
              >
                Passer aux exercices →
              </button>
            </motion.div>
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

          {SUJET_BLANC_1.exercices.map((ex) => (
            <div key={ex.id} className="rounded-2xl border border-slate-700/40 bg-slate-900/40 overflow-hidden">
              <button
                onClick={() => setExpandedEx(expandedEx === ex.id ? null : ex.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/30 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Exercice · {ex.totalPoints} pts
                    </span>
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
                        <MathRichText content={ex.contexte} className="text-sm text-slate-300 leading-relaxed" />
                      </div>

                      {ex.piegesClassiques.length > 0 && (
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-xs font-bold text-amber-400">Pièges à éviter</span>
                          </div>
                          {ex.piegesClassiques.map((piege, i) => (
                            <div key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                              <span className="text-amber-500 shrink-0">·</span>
                              <MathRichText content={piege} />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-3">
                        {ex.questions.map((q) => (
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
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {q.points} pt{q.points > 1 ? 's' : ''}
                                  </span>
                                  {q.competences.map((c) => (
                                    <span
                                      key={c}
                                      className="text-[9px] font-bold rounded px-1.5 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 uppercase"
                                    >
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
            Terminer et voir la correction →
          </button>
        </div>
      )}

      {/* Correction */}
      {mode === 'correction' && (
        <CorrectionView
          onReset={resetExam}
          elapsedSeconds={elapsedSeconds}
          autoTotal={autoTotal}
          exScores={exScores}
          onExScoreChange={(key, pts) => setExScores((prev) => ({ ...prev, [key]: pts }))}
          grandTotal={grandTotal}
        />
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

interface CorrectionViewProps {
  onReset: () => void;
  elapsedSeconds: number;
  autoTotal: number;
  exScores: ExerciceScoreState;
  onExScoreChange: (key: string, pts: number) => void;
  grandTotal: number;
}

const CorrectionView: React.FC<CorrectionViewProps> = ({
  onReset,
  elapsedSeconds,
  autoTotal,
  exScores,
  onExScoreChange,
  grandTotal,
}) => {
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const minutes = Math.floor(elapsedSeconds / 60);
  const exTotal = Object.values(exScores).reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-5">
      {/* Score global */}
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="rounded-lg bg-green-500/20 p-2 shrink-0">
            <Trophy className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">Correction complète — Bilan</h2>
            <p className="text-xs text-slate-400">
              Temps utilisé :{' '}
              {minutes > 120 ? (
                <span className="text-red-400 font-bold">{minutes} min (dépassé de {minutes - 120} min)</span>
              ) : (
                <span className="text-cyan-400 font-bold">{minutes} min / 120 min</span>
              )}
            </p>
          </div>
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-center">
            <div className={`text-2xl font-black ${autoTotal >= 5 ? 'text-green-400' : autoTotal >= 3 ? 'text-amber-400' : 'text-red-400'}`}>
              {autoTotal}
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">/ 6 pts</div>
            <div className="text-xs text-slate-400 mt-1">Automatismes</div>
          </div>
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3 text-center">
            <div className={`text-2xl font-black ${exTotal >= 11 ? 'text-green-400' : exTotal >= 7 ? 'text-amber-400' : 'text-red-400'}`}>
              {Math.round(exTotal * 10) / 10}
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">/ 14 pts</div>
            <div className="text-xs text-slate-400 mt-1">Exercices</div>
          </div>
          <div className={`rounded-xl p-3 text-center border ${
            grandTotal >= 16 ? 'bg-green-500/15 border-green-500/30' :
            grandTotal >= 12 ? 'bg-cyan-500/15 border-cyan-500/30' :
            grandTotal >= 8 ? 'bg-amber-500/15 border-amber-500/30' :
            'bg-red-500/15 border-red-500/30'
          }`}>
            <div className={`text-2xl font-black ${
              grandTotal >= 16 ? 'text-green-400' :
              grandTotal >= 12 ? 'text-cyan-400' :
              grandTotal >= 8 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {grandTotal}
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">/ 20 pts</div>
            <div className="text-xs text-slate-400 mt-1">Total</div>
          </div>
        </div>

        {grandTotal > 0 && (
          <p className="mt-4 text-xs text-slate-400 text-center">
            {grandTotal >= 16 ? '🎉 Excellent ! Tu es prêt(e) pour l\'épreuve.' :
             grandTotal >= 12 ? '👍 Bon niveau — continue à travailler les points faibles.' :
             grandTotal >= 8 ? '📚 Des lacunes à combler — concentre-toi sur les priorités.' :
             '⚠️ Beaucoup de travail à faire — revois les bases avec ton enseignant.'}
          </p>
        )}
      </div>

      {/* Correction automatismes */}
      <div>
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <span className="rounded-lg bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400">Partie 1</span>
          Automatismes — Correction ({autoTotal}/6 pts)
        </h3>
        <div className="space-y-3">
          {SUJET_BLANC_1.automatismes.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-xs font-black text-slate-400 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-300 mb-2">
                    <MathRichText content={q.enonce} />
                  </div>
                  <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-xs font-bold text-green-400">Réponse</span>
                    </div>
                    <div className="text-sm text-green-300">
                      <MathRichText content={q.reponse} />
                    </div>
                    {q.astuce && (
                      <p className="text-xs text-slate-400 mt-1 flex items-start gap-1.5">
                        <Lightbulb className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
                        {q.astuce}
                      </p>
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
          {SUJET_BLANC_1.exercices.map((ex: ExerciceBloc) => {
            const exScore = ex.questions.reduce((sum, q: QuestionExercice) => {
              const key = `${ex.id}-${q.numero}`;
              return sum + (exScores[key] ?? 0);
            }, 0);
            return (
              <div key={ex.id} className="rounded-2xl border border-slate-700/40 bg-slate-900/40 overflow-hidden">
                <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-white">{ex.titre}</h4>
                    <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                      <MathRichText content={ex.contexte} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-lg font-black ${exScore >= ex.totalPoints * 0.8 ? 'text-green-400' : exScore >= ex.totalPoints * 0.5 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {Math.round(exScore * 10) / 10}
                    </div>
                    <div className="text-[10px] text-slate-600 font-bold">/ {ex.totalPoints} pts</div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {ex.questions.map((q: QuestionExercice) => {
                    const qKey = `${ex.id}-${q.numero}`;
                    const qScore = exScores[qKey];
                    const isExpanded = expandedQ === qKey;
                    // Generate scoring options: 0, midpoint (if >1 pt), full
                    const scoreOptions: number[] = q.points === 1
                      ? [0, 1]
                      : q.points === 2
                      ? [0, 1, 2]
                      : [0, Math.round(q.points / 2 * 2) / 2, q.points];

                    return (
                      <div key={q.numero} className="rounded-xl border border-slate-700/40 bg-slate-900/60 overflow-hidden">
                        <button
                          onClick={() => setExpandedQ(isExpanded ? null : qKey)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-bold text-slate-400 shrink-0">
                              {q.numero}
                            </span>
                            <span className="text-sm text-slate-300 truncate">
                              {q.enonce.replace(/\$[^$]*\$/g, '…').slice(0, 60)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {qScore !== undefined && (
                              <span className={`text-xs font-bold ${qScore >= q.points ? 'text-green-400' : qScore > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                {qScore}/{q.points}pt
                              </span>
                            )}
                            <span className="text-xs text-slate-600">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 border-t border-slate-800">
                                {/* Full enonce */}
                                <div className="mt-3 mb-3 text-sm text-slate-300 leading-relaxed">
                                  <MathRichText content={q.enonce} />
                                </div>

                                {/* Solution steps */}
                                <div className="space-y-2 mb-4">
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
                                </div>

                                {/* Competences */}
                                {q.competences.length > 0 && (
                                  <div className="flex items-center gap-1.5 mb-4">
                                    {q.competences.map((c) => (
                                      <span key={c} className="text-[9px] font-bold rounded px-1.5 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 uppercase">
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Self-scoring */}
                                <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">Mon score :</span>
                                  {scoreOptions.map((score) => (
                                    <button
                                      key={score}
                                      onClick={() => onExScoreChange(qKey, score)}
                                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold border transition-all ${
                                        qScore === score
                                          ? score === q.points
                                            ? 'bg-green-500/30 border-green-500 text-green-300'
                                            : score > 0
                                            ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                                            : 'bg-red-500/30 border-red-500 text-red-300'
                                          : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                                      }`}
                                    >
                                      {score === q.points ? `✓ ${score} pt${score > 1 ? 's' : ''}` : score === 0 ? '✗ 0 pt' : `½ ${score} pt${score > 1 ? 's' : ''}`}
                                    </button>
                                  ))}
                                </div>

                                {/* RAG Aide */}
                                <div className="mt-4 pt-3 border-t border-white/5">
                                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Aide Nexus (RAG)</p>
                                  <RAGRemediation chapId={ex.id} chapTitre={ex.titre} compact />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
