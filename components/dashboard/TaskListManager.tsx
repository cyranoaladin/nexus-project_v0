"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TaskList, type TaskItem } from "@/components/dashboard/TaskList";
import { NexusApiClient, type TaskBucket } from "@/ts_client";

const ROLE_TO_API: Record<string, string> = {
  ELEVE: "student",
  PARENT: "parent",
  COACH: "coach",
  ADMIN: "admin",
  ASSISTANTE: "assistante",
};

const TOP_TASKS_LIMIT = 6;

function mapRole(role: string) {
  return ROLE_TO_API[role.toUpperCase()] ?? "student";
}

function parseDueDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

// Group TODO tasks by due date horizon so the UI can mirror the API backlog structure.
function buildBacklogBuckets(tasks: TaskItem[]): TaskBucket[] {
  if (!tasks.length) return [];
  const now = new Date();
  const weekHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthHorizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const buckets: Record<string, TaskItem[]> = {
    "En retard": [],
    "Cette semaine": [],
    "Ce mois-ci": [],
    "À venir": [],
    "Sans échéance": [],
  };

  tasks.forEach((task) => {
    if (task.status !== "Todo") {
      return;
    }
    const dueDate = parseDueDate(task.due_at);
    let target = "Sans échéance";
    if (dueDate) {
      if (dueDate < now) {
        target = "En retard";
      } else if (dueDate <= weekHorizon) {
        target = "Cette semaine";
      } else if (dueDate <= monthHorizon) {
        target = "Ce mois-ci";
      } else {
        target = "À venir";
      }
    }
    buckets[target].push(task);
  });

  const labels = ["En retard", "Cette semaine", "Ce mois-ci", "À venir", "Sans échéance"] as const;
  return labels
    .map((label) => {
      const sorted = [...buckets[label]].sort((a, b) => {
        const dateA = parseDueDate(a.due_at);
        const dateB = parseDueDate(b.due_at);
        if (dateA && dateB) {
          return dateA.getTime() - dateB.getTime();
        }
        if (dateA) return -1;
        if (dateB) return 1;
        return a.label.localeCompare(b.label);
      });
      return { label, tasks: sorted.slice(0, 12) };
    })
    .filter((bucket) => bucket.tasks.length > 0);
}

interface TaskListManagerProps {
  initialTasks: TaskItem[];
  backlog?: TaskBucket[] | null;
  studentId?: string | null;
  actorId: string;
  role: string;
}

type Notice = { type: "success" | "error" | "info"; message: string };

export function TaskListManager({ initialTasks, backlog, studentId, actorId, role }: TaskListManagerProps) {
  const safeBacklog = useMemo(
    () => (backlog ?? []).map((bucket) => ({ label: bucket.label, tasks: [...(bucket.tasks ?? [])] })),
    [backlog],
  );

  const initialKnownTasks = useMemo(() => {
    const byId = new Map<string, TaskItem>();
    initialTasks.forEach((task) => byId.set(task.id, task));
    safeBacklog.forEach((bucket) => {
      bucket.tasks.forEach((task) => {
        if (!byId.has(task.id)) {
          byId.set(task.id, task);
        }
      });
    });
    return Array.from(byId.values());
  }, [initialTasks, safeBacklog]);

  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [knownTasks, setKnownTasks] = useState<TaskItem[]>(initialKnownTasks);
  const [backlogBuckets, setBacklogBuckets] = useState<TaskBucket[]>(
    safeBacklog.length ? safeBacklog : buildBacklogBuckets(initialKnownTasks),
  );
  const [openBuckets, setOpenBuckets] = useState<Record<string, boolean>>({});

  const apiClient = useMemo(() => new NexusApiClient({ baseUrl: "/pyapi" }), []);
  const apiRole = useMemo(() => mapRole(role), [role]);

  const headers = useMemo(() => {
    const data: Record<string, string> = {
      "X-Role": apiRole,
      "X-Actor-Id": actorId,
    };
    if (studentId) {
      data["X-Student-Id"] = studentId;
    }
    return data;
  }, [actorId, apiRole, studentId]);

  const isStudentScopeMissing = !studentId;

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    setKnownTasks(initialKnownTasks);
    setBacklogBuckets(safeBacklog.length ? safeBacklog : buildBacklogBuckets(initialKnownTasks));
  }, [initialKnownTasks, safeBacklog]);

  useEffect(() => {
    if (!backlogBuckets.length) {
      setOpenBuckets({});
      return;
    }
    setOpenBuckets((prev) => {
      const next: Record<string, boolean> = {};
      backlogBuckets.forEach((bucket) => {
        next[bucket.label] = prev[bucket.label] ?? false;
      });
      if (!Object.values(next).some(Boolean)) {
        next[backlogBuckets[0].label] = true;
      }
      return next;
    });
  }, [backlogBuckets]);

  const toggleBucket = useCallback((label: string) => {
    setOpenBuckets((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    setIsRefreshing(true);
    setNotice(null);
    try {
      const response = await apiClient.dashboard.tasks.list(studentId, { headers });
      const fetchedTasks = response.tasks ?? [];
      setKnownTasks(fetchedTasks);
      setBacklogBuckets(buildBacklogBuckets(fetchedTasks));
      const prioritized = fetchedTasks
        .filter((task) => task.status !== "Done")
        .slice(0, TOP_TASKS_LIMIT);
      setTasks(prioritized);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible d'actualiser les tâches";
      setNotice({ type: "error", message });
    } finally {
      setIsRefreshing(false);
    }
  }, [apiClient, headers, studentId]);

  const handleToggleStatus = useCallback(
    async (task: TaskItem, originBucket?: string) => {
      if (!studentId) {
        setNotice({ type: "error", message: "Identifiant élève manquant pour mettre à jour la tâche" });
        return;
      }
      const nextStatus = task.status === "Done" ? "Todo" : "Done";
      setPendingIds((prev) => [...prev, task.id]);
      setNotice(null);
      try {
        const response = await apiClient.dashboard.tasks.complete(task.id, nextStatus, { headers });
        const updated = response.tasks?.[0];
        if (updated) {
          setTasks((prev) =>
            prev.map((item) =>
              item.id === updated.id
                ? {
                    ...item,
                    status: updated.status,
                    due_at: updated.due_at,
                    weight: updated.weight,
                    source: updated.source,
                  }
                : item,
            ),
          );
          setKnownTasks((prev) => {
            const index = prev.findIndex((item) => item.id === updated.id);
            const next = index >= 0
              ? prev.map((item, idx) =>
                  idx === index
                    ? {
                        ...item,
                        status: updated.status,
                        due_at: updated.due_at,
                        weight: updated.weight,
                        source: updated.source,
                      }
                    : item,
                )
              : [...prev, updated];
            const recomputed = buildBacklogBuckets(next);
            setBacklogBuckets(recomputed);
            setOpenBuckets((prevOpen) => {
              const nextOpen: Record<string, boolean> = {};
              recomputed.forEach((bucket) => {
                nextOpen[bucket.label] = prevOpen[bucket.label] ?? bucket.label === originBucket;
              });
              return nextOpen;
            });
            return next;
          });
          setNotice({ type: "success", message: "Tâche mise à jour" });
        } else {
          setNotice({ type: "error", message: "Réponse inattendue du serveur" });
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Impossible de mettre à jour la tâche";
        setNotice({ type: "error", message });
      } finally {
        setPendingIds((prev) => prev.filter((id) => id !== task.id));
      }
    },
    [apiClient, headers, studentId],
  );

  const onTopTaskToggle = useCallback(
    (task: TaskItem) => {
      void handleToggleStatus(task);
    },
    [handleToggleStatus],
  );

  const totalOpenTasks = useMemo(
    () => knownTasks.filter((task) => task.status === "Todo").length,
    [knownTasks],
  );

  const headerContent = (
    <div className="mb-4 space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Tâches prioritaires</h2>
          <p className="text-sm text-slate-500">
            Synchronisées avec
            {" "}
            <Link
              className="font-semibold text-slate-700 underline-offset-2 hover:underline"
              href="/dashboard/tasks"
            >
              la page Tâches
            </Link>
            . Marquez vos actions pour tenir le plan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing || !studentId}
          className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? "Actualisation…" : "Rafraîchir"}
        </button>
      </div>
      <p className="text-xs text-slate-400">
        {totalOpenTasks} tâche{totalOpenTasks > 1 ? "s" : ""} encore à accomplir.
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            notice.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {isStudentScopeMissing ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ajoutez un `student_id` (query string ou variable d&apos;environnement) pour activer la mise à jour des tâches.
        </div>
      ) : null}

      <TaskList
        tasks={tasks}
        onToggleStatus={onTopTaskToggle}
        pendingIds={pendingIds}
        disabled={isStudentScopeMissing}
        showHeader={false}
        headerContent={headerContent}
      />

      {backlogBuckets.length ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Backlog planifié</h3>
            <p className="text-sm text-slate-500">
              Tâches restantes, regroupées par échéance pour garder le cap sur les prochaines étapes.
            </p>
          </div>
          <ul className="space-y-3">
            {backlogBuckets.map((bucket) => {
              const isOpen = openBuckets[bucket.label] ?? false;
              const count = bucket.tasks.length;
              return (
                <li key={bucket.label} className="rounded-md border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => toggleBucket(bucket.label)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <span>{bucket.label}</span>
                    <span className="text-xs font-medium text-slate-500">
                      {count} tâche{count > 1 ? "s" : ""}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {isOpen ? "Masquer" : "Afficher"}
                    </span>
                  </button>
                  {isOpen ? (
                    <ul className="divide-y divide-slate-200">
                      {bucket.tasks.map((item) => {
                        const isPending = pendingIds.includes(item.id);
                        return (
                          <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                            <div>
                              <p className="font-medium text-slate-900">{item.label}</p>
                              <p className="text-xs text-slate-500">
                                {item.due_at
                                  ? `Avant le ${new Date(item.due_at).toLocaleDateString("fr-FR")}`
                                  : "Sans échéance"}
                                {item.weight ? ` · poids ${item.weight.toFixed(1)}` : ""}
                                {item.source ? ` · ${item.source}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(item, bucket.label)}
                              disabled={isStudentScopeMissing || isPending}
                              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isPending ? "Mise à jour…" : "Marquer terminé"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
