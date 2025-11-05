import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { resolveDashboardStudentId } from "@/lib/dashboard/student-scope";
import { NexusApiClient, NexusApiError, type RagDocumentResponse } from "@/ts_client";

type SearchParams = Record<string, string | string[] | undefined>;

function normalizeRole(role: string): string {
  const mapping: Record<string, string> = {
    ELEVE: "student",
    PARENT: "parent",
    COACH: "coach",
    ADMIN: "admin",
    ASSISTANTE: "assistante",
  };
  return mapping[role] ?? "student";
}

interface PageProps {
  params: { documentId: string };
  searchParams: SearchParams;
}

export default async function RagDocumentPage({ params, searchParams }: PageProps) {
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
  const headers: Record<string, string> = {
    "X-Role": normalizeRole(session.user.role),
    "X-Actor-Id": session.user.id,
  };
  if (studentId) {
    headers["X-Student-Id"] = studentId;
  }

  let documentPayload: RagDocumentResponse | null = null;
  let fetchError: string | null = null;
  try {
    documentPayload = await apiClient.rag.doc(params.documentId, { headers });
  } catch (error) {
    if (error instanceof NexusApiError && error.status === 404) {
      notFound();
    }
    fetchError = error instanceof Error ? error.message : "Document indisponible";
  }

  if (!documentPayload) {
    if (fetchError) {
      return (
        <div className="space-y-6">
          <Link
            href={studentId ? `/cours?student_id=${encodeURIComponent(studentId)}` : "/cours"}
            className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            ← Retour aux résultats
          </Link>
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {fetchError}
          </div>
        </div>
      );
    }
    notFound();
  }

  const title = documentPayload.meta?.title ?? documentPayload.path ?? "Document pédagogique";
  const backHref = studentId ? `/cours?student_id=${encodeURIComponent(studentId)}` : "/cours";

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        ← Retour aux résultats
      </Link>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">
          Source&nbsp;: {documentPayload.source} · Version&nbsp;: {documentPayload.version}
        </p>
      </header>

      {documentPayload.meta && Object.keys(documentPayload.meta).length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Métadonnées</h2>
          <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            {Object.entries(documentPayload.meta).map(([key, value]) => (
              <div key={key} className="flex flex-col rounded-md bg-slate-50 p-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="space-y-4">
        {documentPayload.chunks.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            Aucun extrait disponible pour ce document.
          </div>
        ) : (
          documentPayload.chunks.map((chunk) => (
            <article
              key={chunk.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              data-chunk-id={chunk.id}
            >
              <p className="whitespace-pre-line text-sm text-slate-700">{chunk.content}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
