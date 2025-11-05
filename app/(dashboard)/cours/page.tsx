import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { RagSearchPanel } from "@/components/rag/RagSearchPanel";
import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CoursPage({
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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Cours et syllabus</h2>
        <p className="text-sm text-slate-500">
          Recherche unifiée dans les cours, synthèses et ressources pédagogiques.
        </p>
      </header>

      {!studentId ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Identifiant élève introuvable. Renseignez ?student_id=... ou configurez NEXT_PUBLIC_DASHBOARD_STUDENT_ID pour activer la recherche contextualisée.
        </div>
      ) : null}

      <RagSearchPanel
        actorId={session.user.id}
        role={session.user.role}
        studentId={studentId ?? undefined}
        initialQuery="mathématiques"
        emptyMessage="Aucune ressource trouvée pour cette requête. Essayez un autre mot-clé."
      />
    </div>
  );
}
