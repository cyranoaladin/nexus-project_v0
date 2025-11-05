import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { TaskListManager } from "@/components/dashboard/TaskListManager";
import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";
import { buildDashboardHeaders } from "@/lib/dashboard/api-headers";
import { NexusApiClient, type DashboardSummaryResponse } from "@/ts_client";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
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
    summaryError = error instanceof Error ? error.message : "Tâches indisponibles";
  }

  const tasks = summary?.tasks ?? [];
  const backlog = summary?.backlog ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Tâches détaillées</h2>
        <p className="text-sm text-slate-500">
          Gérez vos actions prioritaires, consultez le backlog planifié et synchronisez vos progrès avec vos coachs.
        </p>
      </header>

      {summaryError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {summaryError}
        </div>
      ) : null}

      <TaskListManager
        initialTasks={tasks}
        backlog={backlog}
        studentId={studentId}
        actorId={session.user.id}
        role={session.user.role}
      />
    </div>
  );
}
