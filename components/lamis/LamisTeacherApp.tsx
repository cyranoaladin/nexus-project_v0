"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Download, FileText, RotateCcw, Upload } from "lucide-react";
import { lamisExercises } from "@/src/data/lamisExercises";
import { LAMIS_STORAGE_KEY, buildPedagogicalReport, computeProgressSummary, exportAttemptsCsv } from "@/lib/lamis/progress";
import type { LamisAttempt } from "@/lib/lamis/types";

type StoredState = {
  attempts: LamisAttempt[];
  activeDay?: 1 | 2;
};

function readAttempts(): StoredState {
  if (typeof window === "undefined") return { attempts: [] };
  const raw = window.localStorage.getItem(LAMIS_STORAGE_KEY);
  if (!raw) return { attempts: [] };
  try {
    const parsed = JSON.parse(raw) as StoredState;
    return { attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [], activeDay: parsed.activeDay };
  } catch {
    return { attempts: [] };
  }
}

function secondsLabel(seconds: number): string {
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

export function ExportButton({ attempts }: { attempts: LamisAttempt[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => downloadFile("lamis-attempts.json", JSON.stringify({ attempts }, null, 2), "application/json")} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
        <Download className="h-4 w-4" />
        Export JSON
      </button>
      <button type="button" onClick={() => downloadFile("lamis-attempts.csv", exportAttemptsCsv(lamisExercises, attempts), "text/csv;charset=utf-8")} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
        <Download className="h-4 w-4" />
        Export CSV
      </button>
    </div>
  );
}

export function StudentProgressSummary({ attempts }: { attempts: LamisAttempt[] }) {
  const summary = computeProgressSummary(lamisExercises, attempts);
  const stats = [
    ["Score global", summary.totalScore],
    ["Questions traitées", summary.answeredExerciseIds.length],
    ["Taux de réussite", `${summary.successRate}%`],
    ["Temps total", secondsLabel(summary.totalTimeSeconds)],
    ["Aides utilisées", summary.helpCount],
    ["Corrections vues", summary.correctionCount],
    ["Trop rapides", summary.fastAttempts.length],
    ["À refaire", summary.redoExerciseIds.length],
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
      ))}
    </section>
  );
}

export function AttemptsTable({ attempts }: { attempts: LamisAttempt[] }) {
  const byId = new Map(lamisExercises.map((exercise) => [exercise.id, exercise]));
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Tentatives détaillées</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Heure</th>
              <th className="px-3 py-2">Thème</th>
              <th className="px-3 py-2">Réponse</th>
              <th className="px-3 py-2">Résultat</th>
              <th className="px-3 py-2">Tentative</th>
              <th className="px-3 py-2">Temps</th>
              <th className="px-3 py-2">Aides</th>
              <th className="px-3 py-2">Correction</th>
            </tr>
          </thead>
          <tbody>
            {attempts.slice().reverse().map((attempt, index) => {
              const exercise = byId.get(attempt.exerciseId);
              return (
                <tr key={`${attempt.exerciseId}-${attempt.timestamp}-${index}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{new Date(attempt.timestamp).toLocaleString("fr-FR")}</td>
                  <td className="px-3 py-2 text-slate-800">{exercise?.theme ?? attempt.exerciseId}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-slate-700">{attempt.answer}</td>
                  <td className={`px-3 py-2 font-semibold ${attempt.isCorrect ? "text-emerald-700" : "text-rose-700"}`}>{attempt.isCorrect ? "Juste" : "Faux"}</td>
                  <td className="px-3 py-2">{attempt.attemptNumber}</td>
                  <td className={`px-3 py-2 ${attempt.tooFast ? "font-semibold text-amber-700" : "text-slate-700"}`}>{attempt.timeSpentSeconds}s</td>
                  <td className="px-3 py-2">{Number(attempt.usedHint1) + Number(attempt.usedHint2)}</td>
                  <td className="px-3 py-2">{attempt.viewedCorrection ? "Oui" : "Non"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {attempts.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Aucune tentative importée ou enregistrée dans ce navigateur.</p>}
      </div>
    </section>
  );
}

export function WeaknessesPanel({ attempts }: { attempts: LamisAttempt[] }) {
  const summary = computeProgressSummary(lamisExercises, attempts);
  const exercises = summary.redoExerciseIds.map((id) => lamisExercises.find((exercise) => exercise.id === id)).filter(Boolean);
  const recurring = exercises.reduce<Record<string, number>>((acc, exercise) => {
    if (!exercise) return acc;
    acc[exercise.theme] = (acc[exercise.theme] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950"><RotateCcw className="h-5 w-5 text-rose-600" />Erreurs récurrentes</h2>
      <div className="mt-3 space-y-2">
        {Object.entries(recurring).map(([theme, count]) => (
          <div key={theme} className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-950">
            <span>{theme}</span>
            <span className="font-semibold">{count}</span>
          </div>
        ))}
        {Object.keys(recurring).length === 0 && <p className="text-sm text-slate-500">Pas encore assez de données.</p>}
      </div>
    </section>
  );
}

export function FastAnswersPanel({ attempts }: { attempts: LamisAttempt[] }) {
  const summary = computeProgressSummary(lamisExercises, attempts);
  const byId = new Map(lamisExercises.map((exercise) => [exercise.id, exercise]));
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5" />Réponses trop rapides</h2>
      <div className="mt-3 space-y-2">
        {summary.fastAttempts.map((attempt) => {
          const exercise = byId.get(attempt.exerciseId);
          return <p key={`${attempt.exerciseId}-${attempt.timestamp}`} className="text-sm">{exercise?.theme} - {attempt.timeSpentSeconds}s - {exercise?.statement}</p>;
        })}
        {summary.fastAttempts.length === 0 && <p className="text-sm">Aucune réponse trop rapide enregistrée.</p>}
      </div>
    </section>
  );
}

export function PedagogicalReport({ attempts }: { attempts: LamisAttempt[] }) {
  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5" />Synthèse pédagogique automatique</h2>
      <p className="mt-3 text-sm leading-6">{buildPedagogicalReport(lamisExercises, attempts)}</p>
    </section>
  );
}

export function TeacherDashboard() {
  const [stored, setStored] = useState<StoredState>({ attempts: [] });
  const summary = useMemo(() => computeProgressSummary(lamisExercises, stored.attempts), [stored.attempts]);

  useEffect(() => {
    setStored(readAttempts());
  }, []);

  const importSession = (file: File | null) => {
    if (!file) return;
    file.text().then((text) => {
      const parsed = JSON.parse(text) as StoredState;
      const next = { attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [], activeDay: parsed.activeDay };
      setStored(next);
      window.localStorage.setItem(LAMIS_STORAGE_KEY, JSON.stringify(next));
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-blue-700">Espace enseignant Nexus Réussite</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Suivi Lamis - Mission Maths STMG</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Données de travail, aides, corrections, temps passé et export de session.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExportButton attempts={stored.attempts} />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                <Upload className="h-4 w-4" />
                Import JSON
                <input type="file" accept="application/json" className="sr-only" onChange={(event) => importSession(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </header>

        <StudentProgressSummary attempts={stored.attempts} />

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <WeaknessesPanel attempts={stored.attempts} />
          <FastAnswersPanel attempts={stored.attempts} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950"><BarChart3 className="h-5 w-5 text-blue-600" />Score par thème</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(summary.scoreByTheme).map(([theme, score]) => (
              <div key={theme} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">{theme}</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{score}</p>
              </div>
            ))}
            {Object.keys(summary.scoreByTheme).length === 0 && <p className="text-sm text-slate-500">Aucun score enregistré.</p>}
          </div>
        </section>

        <PedagogicalReport attempts={stored.attempts} />
        <AttemptsTable attempts={stored.attempts} />
      </div>
    </main>
  );
}

export default TeacherDashboard;
