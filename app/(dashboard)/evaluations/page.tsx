import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { EvaluationsManager } from "@/components/eval/EvaluationsManager";
import { authOptions } from "@/lib/auth";
import { buildDashboardHeaders } from "@/lib/dashboard/api-headers";
import { NexusApiClient, type EvaluationResponse } from "@/ts_client";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";

type SearchParams = Record<string, string | string[] | undefined>;

const ROLE_TO_API: Record<string, string> = {
  ELEVE: "student",
  COACH: "coach",
  ADMIN: "admin",
  PARENT: "parent",
  ASSISTANTE: "assistante",
};

function mapRole(role?: string | null): string {
  if (!role) return "student";
  return ROLE_TO_API[role.toUpperCase()] ?? "student";
}

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
  }
  if (!["ELEVE", "COACH", "ADMIN"].includes(session.user.role)) {
    redirect("/");
  }

  const { studentId } = await resolveDashboardStudentId(
    session.user.id,
    session.user.role,
    searchParams,
  );
  const apiClient = new NexusApiClient({ baseUrl: "/pyapi" });

    const headers = buildDashboardHeaders({
      role: mapRole(session.user.role),
      actorId: session.user.id,
      studentId,
    });

  let initialEvaluations: EvaluationResponse[] = [];
  let initialError: string | null = null;

  if (!studentId) {
    initialError =
      "Identifiant élève introuvable. Fournissez ?student_id=... ou configurez NEXT_PUBLIC_DASHBOARD_STUDENT_ID.";
  }

  try {
    if (studentId) {
      initialEvaluations = await apiClient.eval.list(studentId, { headers });
    }
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Impossible de charger les évaluations";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Évaluations & corrections</h2>
        <p className="text-sm text-slate-500">
          Générez un sujet personnalisé, déposez vos copies et suivez les corrections.
        </p>
      </header>
      <EvaluationsManager
        initialStudentId={studentId ?? undefined}
        initialEvaluations={initialEvaluations}
        initialError={initialError ?? undefined}
      />
    </div>
  );
}
