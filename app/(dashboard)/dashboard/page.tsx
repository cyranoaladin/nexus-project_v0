import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AgendaCard } from "@/components/dashboard/AgendaCard";
import { EpreuvesRoadmap } from "@/components/dashboard/EpreuvesRoadmap";
import { KGCanvas } from "@/components/dashboard/KGCanvas";
import { ProgressRadial } from "@/components/dashboard/ProgressRadial";
import { TaskListManager } from "@/components/dashboard/TaskListManager";
import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";
import {
  NexusApiClient,
  type DashboardSummaryResponse,
  type EpreuvesResponse,
  type ProgressEntry,
} from "@/ts_client";
import { buildDashboardHeaders } from "@/lib/dashboard/api-headers";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
  }
  if (session.user.role === "PARENT") {
    redirect("/dashboard/parent");
  }
  if (session.user.role !== "ELEVE") {
    redirect("/");
  }

  const { studentId } = await resolveDashboardStudentId(session.user.id, session.user.role, searchParams);

  const apiClient = new NexusApiClient({ baseUrl: "/pyapi" });
  const headers = buildDashboardHeaders({
    role: "student",
    actorId: session.user.id,
    studentId,
  });

  let summary: DashboardSummaryResponse | null = null;
  let summaryError: string | null = null;
  if (!studentId) {
    summaryError = "Identifiant élève introuvable. Veuillez préciser ?student_id=... ou configurer NEXT_PUBLIC_DASHBOARD_STUDENT_ID.";
  }
  try {
    if (studentId) {
      summary = await apiClient.dashboard.summary(studentId, { headers });
    }
  } catch (error) {
    summaryError = error instanceof Error ? error.message : "Résumé indisponible";
  }

  let progressionEntries: Array<{ id: string; label: string; mastery: number }> = [];
  try {
    if (studentId) {
      const progression = await apiClient.dashboard.progression(studentId, undefined, { headers });
      progressionEntries = progression.entries
        .slice(0, 6)
        .map((entry: ProgressEntry) => ({
          id: `${entry.subject}-${entry.chapter_code}`,
          label: `${entry.subject} · ${entry.chapter_code}`,
          mastery: typeof entry.score === "number" ? Math.max(Math.min(entry.score, 1), 0) : 0,
        }));
    }
  } catch (error) {
    if (!summaryError) {
      summaryError = error instanceof Error ? error.message : "Progression indisponible";
    }
  }

  let epreuvesPayload: EpreuvesResponse | null = null;
  try {
    if (studentId) {
      epreuvesPayload = await apiClient.dashboard.epreuves.get(studentId, { headers });
    }
  } catch (error) {
    if (!summaryError) {
      summaryError = error instanceof Error ? error.message : "Plan d'épreuves indisponible";
    }
  }

  const kpis = summary
    ? [
        {
          value: summary.kpis.progress_overall ?? 0,
          label: "Progression globale",
          caption: `${Math.round((summary.kpis.progress_overall ?? 0) * 100)}% de compétences validées`,
        },
        {
          value: Math.min((summary.kpis.streak_days ?? 0) / 30, 1),
          label: "Série active",
          caption: `${summary.kpis.streak_days ?? 0} jours consécutifs`,
        },
        {
          value: Math.min((summary.kpis.last_eval_score ?? 0) / 20, 1),
          label: "Dernière évaluation",
          caption: summary.kpis.last_eval_score
            ? `${summary.kpis.last_eval_score.toFixed(1)}/20`
            : "En attente de correction",
        },
      ]
    : [
        { value: 0, label: "Progression", caption: "Données non disponibles" },
        { value: 0, label: "Série", caption: "Données non disponibles" },
        { value: 0, label: "Évaluation", caption: "Données non disponibles" },
      ];

  const tasks = summary?.tasks ?? [];
  const backlog = summary?.backlog ?? null;
  const agenda = summary?.upcoming ?? [];

  return (
    <div className="space-y-8">
      {summaryError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {summaryError}
        </div>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Indicateurs clés</h2>
          <Link
            className="text-sm font-semibold text-indigo-700 underline-offset-2 hover:underline"
            href="/dashboard/evaluations"
          >
            Suivre mes évaluations
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {kpis.map((item) => (
            <ProgressRadial key={item.label} {...item} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <TaskListManager
          initialTasks={tasks}
          backlog={backlog}
          studentId={studentId}
          actorId={session.user.id}
          role={session.user.role}
        />
        <AgendaCard items={agenda} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <KGCanvas nodes={progressionEntries} />
        {epreuvesPayload ? (
          <EpreuvesRoadmap
            track={epreuvesPayload.track}
            profile={epreuvesPayload.profile}
            items={epreuvesPayload.items}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-6 text-sm text-slate-500">
            Plan d&apos;épreuves indisponible pour le moment.
          </div>
        )}
      </section>
    </div>
  );
}
