import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";
import { buildDashboardHeaders } from "@/lib/dashboard/api-headers";
import { NexusApiClient, type TaskItem } from "@/ts_client";

type SearchParams = Record<string, string | string[] | undefined>;

const ROLE_TO_API: Record<string, string> = {
  ELEVE: "student",
  PARENT: "parent",
  COACH: "coach",
  ADMIN: "admin",
  ASSISTANTE: "assistante",
};

function mapRole(role?: string | null): string {
  if (!role) return "student";
  return ROLE_TO_API[role.toUpperCase()] ?? "student";
}

function filterParcoursupTasks(tasks: TaskItem[]): TaskItem[] {
  const keywords = ["parcoursup", "voeux", "lettre", "dossier", "fiche avenir"].map((value) => value.toLowerCase());
  return tasks.filter((task) => {
    const target = task.label.toLowerCase();
    return keywords.some((keyword) => target.includes(keyword));
  });
}

export default async function ParcoursupPage({
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

  const { studentId } = await resolveDashboardStudentId(
    session.user.id,
    session.user.role,
    searchParams,
  );
  const apiClient = new NexusApiClient({ baseUrl: "/pyapi" });
  const apiRole = mapRole(session.user.role);
  const headers = buildDashboardHeaders({
    role: apiRole,
    actorId: session.user.id,
    studentId,
  });

  let tasks: TaskItem[] = [];
  let error: string | null = null;

  if (!studentId) {
    error =
      "Identifiant élève introuvable. Ajoutez ?student_id=... ou définissez NEXT_PUBLIC_DASHBOARD_STUDENT_ID pour la checklist Parcoursup.";
  }

  try {
    if (studentId) {
      const response = await apiClient.dashboard.tasks.list(studentId, { headers });
      tasks = filterParcoursupTasks(response.tasks ?? []);
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Impossible de récupérer la checklist Parcoursup";
  }

  const sortedTasks = tasks.slice().sort((a, b) => {
    const aTime = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Parcoursup</h2>
        <p className="text-sm text-slate-500">
          Checklist pilotée par l&apos;agent coach afin de respecter toutes les échéances.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {sortedTasks.length > 0 ? (
        <ul className="space-y-3">
          {sortedTasks.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">{item.label}</h3>
              <p className="text-sm text-slate-600">
                Statut : {item.status}
                {item.source ? ` · ${item.source}` : ""}
              </p>
              <p className="text-xs uppercase tracking-wide text-amber-600">
                {item.due_at
                  ? `Échéance ${new Date(item.due_at).toLocaleDateString("fr-FR")}`
                  : "Échéance à confirmer"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Aucun suivi Parcoursup n&apos;a encore été généré. Le coach pourra créer la checklist via `/dashboard/tasks`.
        </p>
      )}

      <p className="text-xs text-slate-400">
        Les événements agents alimentent cette vue à partir des tâches `/dashboard/tasks`. Synchronisez régulièrement pour suivre l&apos;avancement des pièces administratives.
      </p>
    </div>
  );
}
