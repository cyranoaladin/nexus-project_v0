"use client";

import type { ReactNode } from "react";

import type { TaskItem as ApiTaskItem } from "@/ts_client";

export type TaskItem = ApiTaskItem;

interface TaskListProps {
  tasks: TaskItem[];
  onToggleStatus?: (task: TaskItem) => void;
  pendingIds?: string[];
  disabled?: boolean;
  showHeader?: boolean;
  headerContent?: ReactNode;
}

export function TaskList({ tasks, onToggleStatus, pendingIds = [], disabled = false, showHeader = true, headerContent }: TaskListProps) {
  const pendingSet = new Set(pendingIds);
  const headerNode = headerContent ?? (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-slate-900">Tâches prioritaires</h2>
      <span className="text-xs uppercase tracking-wide text-slate-400">
        {tasks.length} éléments
      </span>
    </div>
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {showHeader || headerContent ? headerNode : null}

      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Aucune recommandation pour le moment. Les agents planificateurs alimenteront cette liste en fonction de vos progrès.
        </p>
      ) : (
        <ul className="space-y-3 text-sm">
          {tasks.map((task) => {
            const isDone = task.status === "Done";
            const toggleLabel = isDone ? "Réouvrir" : "Marquer terminé";
            const isPending = pendingSet.has(task.id);
            return (
              <li
                key={task.id}
                className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-800">{task.label}</p>
                  <p className="text-xs text-slate-500">
                    {task.due_at
                      ? `À faire avant le ${new Date(task.due_at).toLocaleDateString("fr-FR")}`
                      : "Sans échéance"}
                    {task.weight ? ` · poids ${task.weight.toFixed(1)}` : ""}
                    {task.source ? ` · ${task.source}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                      isDone
                        ? "bg-emerald-100 text-emerald-700"
                        : task.status === "Skipped"
                        ? "bg-slate-200 text-slate-600"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {task.status}
                  </span>
                  {onToggleStatus ? (
                    <button
                      type="button"
                      onClick={() => onToggleStatus(task)}
                      disabled={disabled || isPending}
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Mise à jour…" : toggleLabel}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
