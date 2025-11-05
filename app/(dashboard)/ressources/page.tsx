import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { RagSearchPanel } from "@/components/rag/RagSearchPanel";
import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";

type SearchParams = Record<string, string | string[] | undefined>;

function getParamValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

export default async function RessourcesPage({
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
  const initialQuery = getParamValue(searchParams.q) ?? "";
  const filters = getParamValue(searchParams.filters);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Bibliothèque</h2>
        <p className="text-sm text-slate-500">
          Retrouvez les documents recommandés par le moteur RAG et vos favoris.
        </p>
      </header>

      {!studentId ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Identifiant élève introuvable. Ajoutez ?student_id=... ou définissez NEXT_PUBLIC_DASHBOARD_STUDENT_ID pour activer la recherche personnalisée.
        </div>
      ) : null}

      <RagSearchPanel
        actorId={session.user.id}
        role={session.user.role}
        studentId={studentId ?? undefined}
        initialQuery={initialQuery}
        filters={filters}
        emptyMessage="Aucun document ne correspond. Ajustez la requête ou les filtres."
      />

      <p className="text-xs text-slate-400">
        Les favoris présents dans `/dashboard/summary` et les sélections agents apparaîtront ici dès qu&apos;ils seront exposés par l&apos;API. Pour l&apos;instant, les résultats proviennent directement du retriever `/rag/search`.
      </p>
    </div>
  );
}
