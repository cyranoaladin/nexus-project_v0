import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { NexusApiClient, type EpreuvesResponse, type TaskItem } from "@/ts_client";
import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";
import { buildDashboardHeaders } from "@/lib/dashboard/api-headers";

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

function filterGrandOralTasks(tasks: TaskItem[]): TaskItem[] {
  const keywords = ["grand oral", "oral", "GO", "exposé", "question"].map((item) => item.toLowerCase());
  return tasks.filter((task) => {
    const labelLower = task.label.toLowerCase();
    return keywords.some((keyword) => labelLower.includes(keyword));
  });
}

export default async function GrandOralPage({
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

  let epreuves: EpreuvesResponse | null = null;
  let tasks: TaskItem[] = [];
  let error: string | null = null;

  if (!studentId) {
    error =
      "Identifiant élève introuvable. Ajoutez ?student_id=... ou définissez NEXT_PUBLIC_DASHBOARD_STUDENT_ID pour charger le plan Grand Oral.";
  }

  try {
    if (studentId) {
      const [epreuvesPayload, taskPayload] = await Promise.all([
        apiClient.dashboard.epreuves.get(studentId, { headers }),
        apiClient.dashboard.tasks.list(studentId, { headers }),
      ]);
      epreuves = epreuvesPayload;
      tasks = filterGrandOralTasks(taskPayload.tasks ?? []);
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Impossible de récupérer les données Grand Oral";
  }

  const grandOralItem = epreuves?.items.find((item) =>
    item.code.toLowerCase().includes("go") || item.label.toLowerCase().includes("grand oral"),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Grand Oral</h2>
        <p className="text-sm text-slate-500">
          Suivez les jalons préparatoires et les recommandations personnalisées.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {grandOralItem ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Session officielle</h3>
          <p className="text-sm text-slate-600">
            {grandOralItem.label} · {grandOralItem.format}
          </p>
          <p className="text-xs text-slate-500">
            Poids coefficient {grandOralItem.weight.toFixed(1)}
            {grandOralItem.scheduled_at
              ? ` · prévu le ${new Date(grandOralItem.scheduled_at).toLocaleDateString("fr-FR")}`
              : " · date à confirmer"}
          </p>
        </section>
      ) : (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Aucun jalon Grand Oral n&apos;a encore été planifié. Votre coach pourra le synchroniser via `/dashboard/epreuves`.
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Préparation côté élève</h3>
        {tasks.length > 0 ? (
          <ol className="space-y-3">
            {tasks.map((task, index) => (
              <li key={task.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">Étape {index + 1}</p>
                <h4 className="text-sm font-semibold text-slate-900">{task.label}</h4>
                <p className="text-xs text-slate-500">
                  Statut : {task.status}
                  {task.due_at
                    ? ` · échéance ${new Date(task.due_at).toLocaleDateString("fr-FR")}`
                    : " · sans échéance"}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Aucun plan détaillé n&apos;est encore disponible. Contactez l&apos;équipe pédagogique pour générer la checklist Grand Oral.
          </p>
        )}
      </section>

      <p className="text-xs text-slate-400">
        Les jalons et tâches sont synchronisés via `/dashboard/epreuves` et `/dashboard/tasks`. Les agents planner et coach les actualiseront automatiquement.
      </p>
    </div>
  );
}
