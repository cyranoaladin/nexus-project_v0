"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StudentDossier,
  type DossierData,
} from "@/components/dashboard/coach/StudentDossier";
import Link from "next/link";

export default function CoachStudentDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status !== "authenticated") return;

    const fetchDossier = async () => {
      try {
        const res = await fetch(`/api/coach/students/${studentId}/dossier`);
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            router.push("/dashboard/coach");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as DossierData;
        setDossier(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    };

    void fetchDossier();
  }, [status, studentId, router]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="text-rose-400 text-sm mb-2">{error}</p>
          <Link href="/dashboard/coach">
            <Button variant="ghost" className="text-neutral-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la cohorte
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!dossier) return null;

  const { student } = dossier;
  const statusBadgeClass =
    student.status === "CRITICAL"
      ? "bg-rose-500/20 text-rose-400 border border-rose-500/20"
      : student.status === "WARNING"
      ? "bg-amber-500/20 text-amber-400 border border-amber-500/20"
      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20";

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/dashboard/coach">
          <Button variant="ghost" className="mb-6 text-neutral-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la cohorte
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{student.name}</h1>
              {student.status && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeClass}`}
                >
                  {student.status}
                </span>
              )}
            </div>
            <p className="text-neutral-400 text-sm">
              {student.gradeLevel ?? "—"} •{" "}
              {student.academicTrack?.replace(/_/g, " ") ?? "—"}
              {student.stmgPathway ? ` • ${student.stmgPathway}` : ""}
            </p>
          </div>
        </div>

        <StudentDossier data={dossier} />
      </div>
    </div>
  );
}
