import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { buildDashboardHeaders } from "@/lib/dashboard/api-headers";
import { prisma } from "@/lib/prisma";
import { NexusApiClient, type DashboardSummaryResponse } from "@/ts_client";

interface ChildSummary {
  id: string;
  studentDashboardId: string;
  fullName: string;
  grade?: string | null;
  school?: string | null;
  summary: DashboardSummaryResponse | null;
  summaryError: string | null;
}

async function fetchChildrenSummaries(parentUserId: string): Promise<ChildSummary[]> {
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: parentUserId },
    include: {
      children: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              studentProfile: {
                select: {
                  grade: true,
                  school: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parentProfile || parentProfile.children.length === 0) {
    return [];
  }

  const apiClient = new NexusApiClient({ baseUrl: "/pyapi" });

  return Promise.all(
    parentProfile.children.map(async (child) => {
      const studentDashboardId = child.dashboardStudentId ?? child.userId;
      const fullName = [child.user?.firstName, child.user?.lastName].filter(Boolean).join(" ") || "Élève";
      const headers = buildDashboardHeaders({
        role: "parent",
        actorId: parentUserId,
        studentId: studentDashboardId,
      });

      try {
        const summary = await apiClient.dashboard.summary(studentDashboardId, { headers });
        return {
          id: child.id,
          studentDashboardId,
          fullName,
          grade: child.user.studentProfile?.grade,
          school: child.user.studentProfile?.school,
          summary,
          summaryError: null,
        } satisfies ChildSummary;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Données indisponibles";
        return {
          id: child.id,
          studentDashboardId,
          fullName,
          grade: child.user.studentProfile?.grade,
          school: child.user.studentProfile?.school,
          summary: null,
          summaryError: message,
        } satisfies ChildSummary;
      }
    }),
  );
}

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
  }
  if (session.user.role !== "PARENT") {
    redirect("/dashboard");
  }

  const childSummaries = await fetchChildrenSummaries(session.user.id);

  if (childSummaries.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">Aucun élève lié pour le moment</h2>
        <p className="mt-2">Associez un profil élève à votre compte pour accéder à la synthèse parentale.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Suivi de vos élèves</h2>
        <p className="text-sm text-slate-500">
          Visualisez les indicateurs clés de progression, les tâches prioritaires et l&apos;agenda à venir pour chaque élève rattaché à votre compte.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {childSummaries.map((child) => {
          const kpis = child.summary?.kpis;
          const upcoming = child.summary?.upcoming ?? [];
          const nextEvent = upcoming.length > 0 ? upcoming[0] : null;

          return (
            <article key={child.id} className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <header className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{child.fullName}</h3>
                <p className="text-sm text-slate-500">
                  {[child.grade, child.school].filter(Boolean).join(" - ") || "Profil élève"}
                </p>
              </header>

              {child.summaryError ? (
                <p className="text-sm text-amber-600">
                  {child.summaryError}
                </p>
              ) : (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Progression</dt>
                      <dd className="text-base font-semibold text-slate-900">
                        {kpis ? `${Math.round((kpis.progress_overall ?? 0) * 100)}%` : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Série active</dt>
                      <dd className="text-base font-semibold text-slate-900">
                        {kpis ? `${kpis.streak_days ?? 0} jours` : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Dernière évaluation</dt>
                      <dd className="text-base font-semibold text-slate-900">
                        {kpis?.last_eval_score != null ? `${kpis.last_eval_score.toFixed(1)}/20` : "En attente"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Prochain événement</dt>
                      <dd className="text-base font-semibold text-slate-900">
                        {nextEvent ? nextEvent.title : "Aucun"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex flex-col gap-2 pt-4">
                    <Button asChild variant="secondary">
                      <Link href={`/dashboard?student_id=${encodeURIComponent(child.studentDashboardId)}`}>
                        Ouvrir la synthèse élève
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/dashboard?student_id=${encodeURIComponent(child.studentDashboardId)}`}>
                        Gérer les tâches et l&apos;agenda
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
