"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StudentDocumentsManager from "@/components/dashboard/assistante/StudentDocumentsManager";

type OverviewResponse = {
  success: true;
  student: {
    id: string;
    userId: string;
    grade: string | null;
    gradeLevel: string;
    academicTrack: string;
    specialties: string[];
    stmgPathway: string | null;
    school: string | null;
    birthDate: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
      firstName: string | null;
      lastName: string | null;
      email: string;
      activatedAt: string | null;
      createdAt: string;
    };
    parent: {
      id: string;
      user: {
        firstName: string | null;
        lastName: string | null;
        email: string;
        phone: string | null;
      };
    };
    subscriptions: Array<{
      id: string;
      planName: string;
      monthlyPrice: number;
      creditsPerMonth: number;
      status: string;
      startDate: string;
      endDate: string | null;
      ariaCost: number;
      ariaSubjects: unknown;
      createdAt: string;
    }>;
  };
  creditBalance: number;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
    expiresAt: string | null;
    sessionId: string | null;
  }>;
  assignments: Array<{
    id: string;
    assignmentType: string;
    status: string;
    subjects: string[];
    notes: string | null;
    startsAt: string;
    endsAt: string | null;
    coach: {
      id: string;
      user: {
        firstName: string | null;
        lastName: string | null;
        email: string;
      };
    };
    assignedBy: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  }>;
};

export default function AssistanteStudentProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/assistante/students/${studentId}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      setData(body as OverviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== "ASSISTANTE") {
      router.push("/auth/signin");
      return;
    }

    fetchOverview();
  }, [status, session, router, fetchOverview]);

  const resendStudentActivation = async (email: string) => {
    try {
      const res = await fetch("/api/auth/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Échec envoi");
      toast.success(body?.message || "Lien d'activation renvoyé.");
      fetchOverview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    }
  };

  const sendParentPasswordReset = async (email: string) => {
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Échec envoi");
      toast.success(body?.message || "Lien de réinitialisation envoyé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-surface-card border border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Erreur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-rose-200">{error || "Élève introuvable"}</p>
            <div className="flex gap-2">
              <Link href="/dashboard/assistante/students">
                <Button variant="outline" className="border-white/10 text-neutral-200 hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <Button onClick={fetchOverview} className="btn-primary">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const studentName = `${data.student.user.firstName || ""} ${data.student.user.lastName || ""}`.trim() || "Élève";
  const parentName = `${data.student.parent.user.firstName || ""} ${data.student.parent.user.lastName || ""}`.trim() || "Parent";
  const studentActivated = Boolean(data.student.user.activatedAt);

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard/assistante/students">
            <Button variant="outline" className="border-white/10 text-neutral-200 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Liste élèves
            </Button>
          </Link>
          <Button onClick={fetchOverview} variant="outline" className="border-white/10 text-neutral-200 hover:text-white">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-surface-card border border-white/10 shadow-premium lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-white">{studentName}</CardTitle>
                <p className="text-sm text-neutral-400">{data.student.user.email}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {data.student.gradeLevel} • {data.student.academicTrack.replace(/_/g, " ")}
                  {data.student.grade ? ` • ${data.student.grade}` : ""}
                  {data.student.school ? ` • ${data.student.school}` : ""}
                </p>
              </div>
              <Badge variant={studentActivated ? "default" : "outline"} className={studentActivated ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "border-amber-500/20 text-amber-200"}>
                {studentActivated ? "Activé" : "En attente d'activation"}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link href={`/dashboard/assistante/credits?studentId=${data.student.id}`}>
                <Button variant="outline" className="border-white/10 text-neutral-200 hover:text-white">
                  Gérer crédits
                </Button>
              </Link>
              <Link href={`/dashboard/assistante/assignments?studentId=${data.student.id}`}>
                <Button variant="outline" className="border-white/10 text-neutral-200 hover:text-white">
                  Voir assignations
                </Button>
              </Link>
              <Link href={`/dashboard/assistante/subscriptions?tab=active&studentId=${data.student.id}`}>
                <Button variant="outline" className="border-white/10 text-neutral-200 hover:text-white">
                  Voir abonnements
                </Button>
              </Link>
              {!studentActivated && (
                <Button
                  className="btn-primary"
                  onClick={() => resendStudentActivation(data.student.user.email)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Renvoyer activation
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="text-white text-base">Parent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-white">{parentName}</p>
              <p className="text-xs text-neutral-400">{data.student.parent.user.email}</p>
              {data.student.parent.user.phone && (
                <p className="text-xs text-neutral-500">{data.student.parent.user.phone}</p>
              )}
              <Button
                variant="outline"
                className="w-full border-white/10 text-neutral-200 hover:text-white"
                onClick={() => sendParentPasswordReset(data.student.parent.user.email)}
              >
                Renvoyer reset parent
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-surface-card border border-white/10 shadow-premium lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white text-base">Abonnements</CardTitle>
            </CardHeader>
            <CardContent>
              {data.student.subscriptions.length === 0 ? (
                <p className="text-sm text-neutral-400">Aucun abonnement.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-300">
                        <th className="text-left py-2 pr-3 font-medium">Plan</th>
                        <th className="text-left py-2 pr-3 font-medium">Statut</th>
                        <th className="text-left py-2 pr-3 font-medium">Début</th>
                        <th className="text-left py-2 pr-3 font-medium">Fin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.student.subscriptions.slice(0, 10).map((sub) => (
                        <tr key={sub.id} className="border-b border-white/10">
                          <td className="py-2 pr-3 text-neutral-100">{sub.planName}</td>
                          <td className="py-2 pr-3">
                            <Badge variant="outline" className="border-white/10 text-neutral-300">
                              {sub.status}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-neutral-300">
                            {new Date(sub.startDate).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="py-2 pr-3 text-neutral-300">
                            {sub.endDate ? new Date(sub.endDate).toLocaleDateString("fr-FR") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="text-white text-base">Crédits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-neutral-400">Solde</span>
                <span className="text-2xl font-bold text-brand-accent">
                  {Math.round(data.creditBalance * 100) / 100}
                </span>
              </div>
              <div className="space-y-2">
                {(data.recentTransactions || []).slice(0, 8).map((t) => (
                  <div key={t.id} className="rounded border border-white/10 bg-white/5 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-300">{t.type}</span>
                      <span className={`text-xs font-semibold ${t.amount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {t.amount >= 0 ? "+" : ""}
                        {t.amount}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 line-clamp-2">{t.description}</p>
                  </div>
                ))}
                {(!data.recentTransactions || data.recentTransactions.length === 0) && (
                  <p className="text-sm text-neutral-400">Aucune transaction.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-surface-card border border-white/10 shadow-premium lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white text-base">Assignations actives</CardTitle>
            </CardHeader>
            <CardContent>
              {data.assignments.length === 0 ? (
                <p className="text-sm text-neutral-400">Aucune assignation active.</p>
              ) : (
                <div className="space-y-2">
                  {data.assignments.map((a) => (
                    <div key={a.id} className="rounded border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-white">
                            {a.coach.user.firstName || ""} {a.coach.user.lastName || ""}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {a.assignmentType} • démarré le {new Date(a.startsAt).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-white/10 text-neutral-300">
                          {a.status}
                        </Badge>
                      </div>
                      {a.subjects?.length > 0 && (
                        <p className="text-xs text-neutral-400 mt-2">
                          Matières : {a.subjects.join(", ")}
                        </p>
                      )}
                      {a.notes && <p className="text-xs text-neutral-400 mt-1">{a.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <StudentDocumentsManager studentId={data.student.id} studentName={studentName} onDocumentCreated={fetchOverview} />
          </div>
        </div>
      </div>
    </div>
  );
}
