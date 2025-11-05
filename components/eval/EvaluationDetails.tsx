"use client";

import { useMemo } from "react";

import type { EvaluationResponse } from "@/ts_client";

interface EvaluationDetailsProps {
  evaluation: EvaluationResponse | null;
  className?: string;
}

function formatDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return "0 octet";
  const units = ["octets", "Ko", "Mo", "Go"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatSubmittedBy(value: string | undefined | null): string {
  const mapping: Record<string, string> = {
    student: "Élève",
    coach: "Coach",
    admin: "Administrateur",
  };
  if (!value) return "—";
  return mapping[value] ?? value;
}

export function EvaluationDetails({ evaluation, className }: EvaluationDetailsProps) {
  const metadataEntries = useMemo(() => {
    if (!evaluation) return [];
    return Object.entries(evaluation.metadata ?? {})
      .filter(([key]) => key !== "constraints")
      .map(([key, value]) => ({ key, value }));
  }, [evaluation]);

  const constraintsEntries = useMemo(() => {
    if (!evaluation) return [];
    const rawConstraints = evaluation.metadata?.constraints;
    if (!rawConstraints) return [];
    if (typeof rawConstraints === "object") {
      return Object.entries(rawConstraints as Record<string, string | number>);
    }
    if (typeof rawConstraints === "string") {
      try {
        const parsed = JSON.parse(rawConstraints) as Record<string, string | number>;
        if (parsed && typeof parsed === "object") {
          return Object.entries(parsed);
        }
      } catch (error) {
        console.warn("Impossible de parser les contraintes", error);
      }
    }
    return [];
  }, [evaluation]);

  if (!evaluation) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm ${className ?? ""}`}>
        Sélectionnez une évaluation pour visualiser les détails, dépôts et feedback.
      </div>
    );
  }

  const submissions = evaluation.submissions ?? [];
  const feedbackItems = evaluation.feedback ?? [];
  const historyItems = evaluation.history ?? [];

  return (
    <div className={`space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm ${className ?? ""}`}>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Évaluation sélectionnée</p>
        <h3 className="text-base font-semibold text-slate-900">{evaluation.subject} · {evaluation.duration_min} min</h3>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          Statut : {evaluation.status}
        </span>
      </header>

      <dl className="grid gap-2 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Créée le</dt>
          <dd>{formatDate(evaluation.created_at) ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Note</dt>
          <dd>{evaluation.score_20 !== null && evaluation.score_20 !== undefined ? `${evaluation.score_20}/20` : "En attente"}</dd>
        </div>
        {metadataEntries.map(({ key, value }) => {
          let display = String(value ?? "");
          if (typeof value === "string") {
            const formatted = formatDate(value);
            if (formatted) {
              display = formatted;
            }
          }
          return (
            <div key={key} className="flex items-center justify-between">
              <dt className="font-medium text-slate-500 capitalize">{key}</dt>
              <dd className="text-right">{display || "—"}</dd>
            </div>
          );
        })}
      </dl>

      {constraintsEntries.length ? (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Contraintes</h4>
          <ul className="space-y-1 text-sm text-slate-600">
            {constraintsEntries.map(([key, value]) => (
              <li key={key} className="flex items-center justify-between">
                <span className="capitalize">{key}</span>
                <span className="text-right text-slate-500">{String(value)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {submissions.length ? (
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Historique des dépôts</h4>
            <p className="text-xs text-slate-500">
              {submissions.length === 1
                ? "Un dépôt enregistré"
                : `${submissions.length} dépôts enregistrés`}
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            {submissions.map((submission, index) => (
              <li
                key={`${submission.submitted_at}-${index}`}
                className="rounded-md border border-slate-100 bg-slate-50 p-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{formatDate(submission.submitted_at) ?? "Date inconnue"}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-600">
                    {formatSubmittedBy(submission.submitted_by)}
                  </span>
                  <span>{submission.files.length} fichier(s)</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {submission.files.map((file) => (
                    <li
                      key={`${submission.submitted_at}-${file.sha256}`}
                      className="flex flex-col rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                    >
                      <span className="font-medium text-slate-700">{file.name}</span>
                      <span>
                        {file.content_type ?? "Format inconnu"} · {formatBytes(file.size_bytes)} ·
                        <span className="ml-1 font-mono text-[11px] text-slate-500">
                          {(file.sha256 ?? "").slice(0, 8)}...
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-slate-500">Aucun dépôt enregistré pour le moment.</p>
      )}

      {feedbackItems.length ? (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Feedback</h4>
          <ul className="space-y-2 text-sm text-slate-600">
            {feedbackItems.map((item, index) => (
              <li key={`${item.step}-${index}`} className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-emerald-600">{item.step}</p>
                <p>{item.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-slate-500">Feedback en attente.</p>
      )}

      {historyItems.length ? (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Historique des notes</h4>
          <ul className="space-y-1 text-sm text-slate-600">
            {historyItems
              .slice()
              .sort((a, b) => new Date(b.graded_at).getTime() - new Date(a.graded_at).getTime())
              .map((entry, index) => (
                <li key={`${entry.graded_at}-${index}`} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <span>{formatDate(entry.graded_at) ?? entry.graded_at}</span>
                  <span className="font-semibold text-slate-800">{entry.score_20}/20</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
