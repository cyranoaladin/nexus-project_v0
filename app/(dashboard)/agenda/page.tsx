import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AgendaManager } from "@/components/dashboard/AgendaManager";
import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";
import { buildDashboardHeaders } from "@/lib/dashboard/api-headers";
import { NexusApiClient, type AgendaItem } from "@/ts_client";

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

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
  }
  if (session.user.role !== "ELEVE" && session.user.role !== "COACH" && session.user.role !== "ADMIN") {
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

  let agendaItems: AgendaItem[] = [];
  let agendaError: string | null = null;

  if (!studentId) {
    agendaError =
      "Identifiant élève introuvable. Veuillez préciser ?student_id=... ou configurer NEXT_PUBLIC_DASHBOARD_STUDENT_ID.";
  }

  try {
    if (studentId) {
      const response = await apiClient.dashboard.agenda(studentId, undefined, undefined, { headers });
      agendaItems = response.items ?? [];
    }
  } catch (error) {
    agendaError = error instanceof Error ? error.message : "Agenda indisponible";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Agenda détaillé</h2>
        <p className="text-sm text-slate-500">
          Visualisez vos sessions confirmées, en attente ou proposées.
        </p>
      </header>
      {agendaError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {agendaError}
        </div>
      ) : null}
      <AgendaManager
        initialAgenda={agendaItems}
        initialError={agendaError}
        studentId={studentId ?? undefined}
      />
    </div>
  );
}
