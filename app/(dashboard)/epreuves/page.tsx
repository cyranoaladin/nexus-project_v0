import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { EpreuvesRoadmap } from "@/components/dashboard/EpreuvesRoadmap";
import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";
import { buildDashboardHeaders } from "@/lib/dashboard/api-headers";
import { NexusApiClient, type EpreuvesResponse } from "@/ts_client";

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

export default async function EpreuvesPage({
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
  let error: string | null = null;

  if (!studentId) {
    error =
      "Identifiant élève introuvable. Renseignez ?student_id=... ou configurez NEXT_PUBLIC_DASHBOARD_STUDENT_ID.";
  }

  try {
    if (studentId) {
      epreuves = await apiClient.dashboard.epreuves.get(studentId, { headers });
    }
  } catch (cause) {
    error =
      cause instanceof Error ? cause.message : "Impossible de récupérer le plan d'épreuves";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Épreuves personnalisées</h2>
        <p className="text-sm text-slate-500">
          Plan ajusté selon votre profil (Première/Terminale, scolarisé ou candidat libre).
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {epreuves ? (
        epreuves.items.length > 0 ? (
          <EpreuvesRoadmap
            track={epreuves.track}
            profile={epreuves.profile}
            items={epreuves.items}
          />
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Aucun jalon n&apos;est encore planifié pour cet élève. Contactez votre coach pour initialiser le parcours.
          </p>
        )
      ) : null}

      <p className="text-xs text-slate-400">
        Les données proviennent de l&apos;API `/dashboard/epreuves` et sont synchronisées par le planner.
      </p>
    </div>
  );
}
