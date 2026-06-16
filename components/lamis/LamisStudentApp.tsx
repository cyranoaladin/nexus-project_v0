"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Award, CheckCircle2, Download, HelpCircle, RotateCcw, Send, Target, Timer, Upload, XCircle } from "lucide-react";
import { lamisExercises } from "@/src/data/lamisExercises";
import { LAMIS_STORAGE_KEY, computeProgressSummary, isAnswerCorrect, recordAttempt } from "@/lib/lamis/progress";
import type { LamisAttempt, LamisExercise } from "@/lib/lamis/types";

type StoredState = {
  attempts: LamisAttempt[];
  activeDay: 1 | 2;
};

const initialState: StoredState = { attempts: [], activeDay: 1 };

function readState(): StoredState {
  if (typeof window === "undefined") return initialState;
  const raw = window.localStorage.getItem(LAMIS_STORAGE_KEY);
  if (!raw) return initialState;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      activeDay: parsed.activeDay === 2 ? 2 : 1,
    };
  } catch {
    return initialState;
  }
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes} min ${rest}s` : `${rest}s`;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-200" aria-label={`Progression ${value}%`}>
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
      <Award className="h-4 w-4" aria-hidden="true" />
      {score} points
    </div>
  );
}

export function HintBox({ exercise, level }: { exercise: LamisExercise; level: 1 | 2 }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">Indice {level}</p>
      <p className="mt-1">{level === 1 ? exercise.hint1 : exercise.hint2}</p>
    </div>
  );
}

export function CorrectionBox({ exercise }: { exercise: LamisExercise }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
      <p className="font-semibold">Correction courte</p>
      <p className="mt-1">{exercise.correction}</p>
      <p className="mt-2 text-blue-900">{exercise.explanation}</p>
    </div>
  );
}

export function MissionCard({ day, active, onSelect }: { day: 1 | 2; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border p-4 text-left transition ${active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}
    >
      <p className="text-xs font-bold uppercase text-emerald-700">Jour {day}</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-950">{day === 1 ? "Automatismes et QCM" : "Exercices type épreuve"}</h2>
      <p className="mt-2 text-sm text-slate-600">{day === 1 ? "Points faciles : pourcentages, mental, équations." : "Suites, probabilités, fonctions et sujet express."}</p>
    </button>
  );
}

export function ExerciseCard({
  exercise,
  index,
  total,
  attempts,
  onAttempt,
  onNext,
}: {
  exercise: LamisExercise;
  index: number;
  total: number;
  attempts: LamisAttempt[];
  onAttempt: (answer: string, seconds: number, hint1: boolean, hint2: boolean, correction: boolean) => void;
  onNext: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);

  const exerciseAttempts = attempts.filter((attempt) => attempt.exerciseId === exercise.id);
  const lastAttempt = exerciseAttempts[exerciseAttempts.length - 1];
  const attemptNumber = exerciseAttempts.length + 1;
  const isResolved = Boolean(lastAttempt?.isCorrect || (lastAttempt?.attemptNumber >= 2 && lastAttempt.viewedCorrection));
  const canRetry = Boolean(lastAttempt && !lastAttempt.isCorrect && lastAttempt.attemptNumber < 2);
  const showCorrection = Boolean(lastAttempt && (!lastAttempt.isCorrect && lastAttempt.attemptNumber >= 2 || lastAttempt.isCorrect));

  useEffect(() => {
    setAnswer("");
    setStartedAt(Date.now());
    setHintLevel(0);
  }, [exercise.id]);

  const submit = (forcedAnswer?: string) => {
    const value = forcedAnswer ?? answer;
    if (!value.trim()) return;
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const nextAttemptNumber = exerciseAttempts.length + 1;
    const willBeCorrect = isAnswerCorrect(exercise, value);
    const correction = !willBeCorrect && nextAttemptNumber >= 2;
    onAttempt(value, seconds, hintLevel >= 1, hintLevel >= 2, correction);
    setAnswer("");
    setStartedAt(Date.now());
    if (!willBeCorrect) setHintLevel((current) => (current === 0 ? 1 : current));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{exercise.theme}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{exercise.level}</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Tentative {Math.min(attemptNumber, 2)}/2</span>
        </div>
        <p className="text-sm text-slate-500">{index + 1}/{total}</p>
      </div>

      <p className="mt-5 text-lg font-semibold leading-relaxed text-slate-950">{exercise.statement}</p>

      <div className="mt-5 space-y-3">
        {exercise.type === "qcm" && exercise.choices ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {exercise.choices.map((choice) => (
              <button key={choice} type="button" disabled={isResolved && !canRetry} onClick={() => setAnswer(choice)} className={`rounded-lg border px-4 py-3 text-left text-sm font-medium ${answer === choice ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            value={answer}
            disabled={isResolved && !canRetry}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={exercise.type === "justification" ? 4 : 2}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder={exercise.type === "justification" ? "Écris ton raisonnement..." : "Ta réponse obligatoire..."}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!answer.trim() || (isResolved && !canRetry)} onClick={() => submit()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            <Send className="h-4 w-4" aria-hidden="true" />
            Valider ma réponse
          </button>
          <button type="button" onClick={() => setHintLevel((current) => (current === 0 ? 1 : 2))} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            J’ai besoin d’un indice
          </button>
          <button type="button" disabled={isResolved && !canRetry} onClick={() => { setHintLevel(1); submit("Je ne sais pas"); }} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-40">
            Je ne sais pas
          </button>
        </div>
      </div>

      {hintLevel >= 1 && <div className="mt-4"><HintBox exercise={exercise} level={1} /></div>}
      {hintLevel >= 2 && <div className="mt-3"><HintBox exercise={exercise} level={2} /></div>}

      {lastAttempt && (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${lastAttempt.isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          <p className="flex items-center gap-2 font-semibold">
            {lastAttempt.isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {lastAttempt.isCorrect ? "Très bien. C’est exactement le réflexe attendu le jour de l’épreuve." : "Ce n’est pas encore juste. Tu as fait une tentative, c’est bien. Maintenant, regarde l’indice et corrige."}
          </p>
          {lastAttempt.tooFast && <p className="mt-2 font-medium">Tu as répondu très vite. Pour valider le travail, prends le temps d’écrire ton raisonnement.</p>}
        </div>
      )}

      {showCorrection && <div className="mt-4"><CorrectionBox exercise={exercise} /></div>}

      {isResolved && (
        <button type="button" onClick={onNext} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
          Question suivante
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

export function RetryPanel({ redoCount, onStart }: { redoCount: number; onStart: () => void }) {
  return (
    <section className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-950">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><RotateCcw className="h-5 w-5" />Reprise obligatoire</h2>
      <p className="mt-2 text-sm">Il reste {redoCount} question(s) à refaire. Pour valider la mission, tu dois en corriger au moins une série.</p>
      <button type="button" onClick={onStart} className="mt-4 rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white">Refaire mes erreurs</button>
    </section>
  );
}

export function EndMissionSummary({ summary }: { summary: ReturnType<typeof computeProgressSummary> }) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
      <h2 className="text-xl font-semibold">Mission validée</h2>
      <p className="mt-2">Tu as travaillé sérieusement. Les questions à refaire sont prêtes pour demain.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div><p className="text-sm">Score</p><p className="text-2xl font-bold">{summary.totalScore}</p></div>
        <div><p className="text-sm">Réussite</p><p className="text-2xl font-bold">{summary.successRate}%</p></div>
        <div><p className="text-sm">Temps</p><p className="text-2xl font-bold">{formatSeconds(summary.totalTimeSeconds)}</p></div>
      </div>
    </section>
  );
}

export function ErrorReviewList({ exercises, redoIds }: { exercises: LamisExercise[]; redoIds: string[] }) {
  const redoExercises = exercises.filter((exercise) => redoIds.includes(exercise.id)).slice(0, 10);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-slate-950">À refaire</h2>
      <div className="mt-3 space-y-2">
        {redoExercises.length ? redoExercises.map((exercise) => (
          <p key={exercise.id} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-950">{exercise.theme} - {exercise.statement}</p>
        )) : <p className="text-sm text-slate-500">Aucune erreur enregistrée pour l’instant.</p>}
      </div>
    </section>
  );
}

export function StudentDashboard() {
  const [state, setState] = useState<StoredState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [redoMode, setRedoMode] = useState(false);

  useEffect(() => {
    setState(readState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(LAMIS_STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const summary = useMemo(() => computeProgressSummary(lamisExercises, state.attempts), [state.attempts]);
  const dayExercises = useMemo(() => {
    const base = lamisExercises.filter((exercise) => exercise.day === state.activeDay);
    return redoMode ? base.filter((exercise) => summary.redoExerciseIds.includes(exercise.id)) : base;
  }, [state.activeDay, redoMode, summary.redoExerciseIds]);
  const current = dayExercises[cursor];
  const completed = Math.min(dayExercises.length, summary.answeredExerciseIds.filter((id) => dayExercises.some((exercise) => exercise.id === id)).length);
  const progress = dayExercises.length ? Math.round((completed / dayExercises.length) * 100) : 100;

  if (!hydrated) return <main className="min-h-screen bg-slate-50 p-6 text-slate-700">Chargement de la mission...</main>;

  const saveAttempt = (answer: string, seconds: number, hint1: boolean, hint2: boolean, correction: boolean) => {
    if (!current) return;
    const previousAttempts = state.attempts.filter((attempt) => attempt.exerciseId === current.id).length;
    const attempt = recordAttempt(current, answer, Math.min(previousAttempts + 1, 2), seconds, hint1, hint2, correction);
    setState((prev) => ({ ...prev, attempts: [...prev.attempts, attempt] }));
  };

  const next = () => {
    setCursor((value) => Math.min(value + 1, dayExercises.length));
  };

  const importSession = (file: File | null) => {
    if (!file) return;
    file.text().then((text) => {
      const parsed = JSON.parse(text) as StoredState;
      setState({ attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [], activeDay: parsed.activeDay === 2 ? 2 : 1 });
      setCursor(0);
    });
  };

  const needsRetry = !current && summary.redoExerciseIds.length > 0 && !state.attempts.some((attempt) => attempt.isCorrect && attempt.attemptNumber > 1);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-emerald-700">Nexus Réussite - Première STMG</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Mission Lamis - Objectif Bac Maths STMG</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Préparation guidée à l’épreuve anticipée du 8 juin 2026. Une réponse est obligatoire à chaque étape.</p>
            </div>
            <ScoreBadge score={summary.totalScore} />
          </div>
          <div className="mt-5"><ProgressBar value={progress} /></div>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          <MissionCard day={1} active={state.activeDay === 1} onSelect={() => { setState((prev) => ({ ...prev, activeDay: 1 })); setCursor(0); setRedoMode(false); }} />
          <MissionCard day={2} active={state.activeDay === 2} onSelect={() => { setState((prev) => ({ ...prev, activeDay: 2 })); setCursor(0); setRedoMode(false); }} />
        </section>

        <section className="flex flex-wrap items-center gap-2">
          {summary.badges.map((badge) => <span key={badge} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">{badge}</span>)}
          <button type="button" onClick={() => downloadFile("mission-lamis-session.json", JSON.stringify(state, null, 2), "application/json")} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Download className="h-4 w-4" />Export JSON</button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Upload className="h-4 w-4" />Import JSON<input type="file" accept="application/json" className="sr-only" onChange={(event) => importSession(event.target.files?.[0] ?? null)} /></label>
        </section>

        {current ? (
          <ExerciseCard exercise={current} index={cursor} total={dayExercises.length} attempts={state.attempts} onAttempt={saveAttempt} onNext={next} />
        ) : needsRetry ? (
          <RetryPanel redoCount={summary.redoExerciseIds.length} onStart={() => { setRedoMode(true); setCursor(0); }} />
        ) : (
          <EndMissionSummary summary={summary} />
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <ErrorReviewList exercises={lamisExercises} redoIds={summary.redoExerciseIds} />
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950"><Timer className="h-5 w-5 text-emerald-600" />Anti-faux travail</h2>
            <p className="mt-2 text-sm text-slate-600">Questions traitées : {summary.answeredExerciseIds.length}. Réponses trop rapides : {summary.fastAttempts.length}. Aides consultées : {summary.helpCount}.</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><Target className="h-4 w-4 text-emerald-600" />Objectif : écrire avant de cliquer.</p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default StudentDashboard;
