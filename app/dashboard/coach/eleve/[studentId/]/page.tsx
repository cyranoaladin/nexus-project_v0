"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Target, History, TrendingUp, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPilotage } from "@/components/dashboard/DashboardPilotage";
import { TrajectoryDesigner } from "@/components/dashboard/coach/TrajectoryDesigner";
import { ProgressEvolutionChart } from "@/components/dashboard/parent/ProgressEvolutionChart";
import Link from "next/link";

export default function CoachStudentDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;
  
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    const fetchStudentData = async () => {
      try {
        const response = await fetch('/api/coach/dashboard');
        const data = await response.json();
        const student = data.students.find((s: any) => s.id === studentId);
        if (student) {
          // Fetch more details if needed, for now we use what we have
          setStudentData(student);
        } else {
          router.push("/dashboard/coach");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchStudentData();
    }
  }, [status, studentId, router]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (!studentData) return null;

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/dashboard/coach">
          <Button variant="ghost" className="mb-6 text-neutral-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la cohorte
          </Button>
        </Link>

        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{studentData.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                studentData.status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' :
                studentData.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' :
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
              }`}>
                {studentData.status}
              </span>
            </div>
            <p className="text-neutral-400">
              {studentData.gradeLevel} • {studentData.academicTrack.replace('_', ' ')}
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div className="bg-surface-card border border-white/10 p-4 rounded-xl min-w-[120px]">
              <p className="text-[10px] uppercase text-neutral-500 font-bold mb-1">NexusIndex</p>
              <p className="text-2xl font-bold text-brand-accent">{studentData.nexusIndex ?? '--'}</p>
            </div>
          </div>
        </div>

        <DashboardPilotage role="COACH" studentId={studentId}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Progress Chart (reused from parent) */}
              <ProgressEvolutionChart data={studentData.progressionHistory || []} />
              
              {/* Historique des séances */}
              <Card className="bg-surface-card border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <History className="w-4 h-4 text-brand-accent" />
                    Historique Pédagogique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                      <p className="text-sm font-bold text-white">Dernier rapport (24/04)</p>
                      <p className="text-xs text-neutral-400 mt-1 italic">
                        "L'élève a bien compris le concept de dérivée mais bloque encore sur les fonctions composées. Travail sur les exercices types BAC nécessaire."
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              <TrajectoryDesigner studentId={studentId} onSave={(d) => console.log(d)} />
              
              <Card className="bg-surface-card border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    Ressources Assignées
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="p-2 bg-white/5 rounded text-xs text-neutral-300 border border-white/10 flex justify-between">
                    <span>Livret STMG — Chapitre 3</span>
                    <span className="text-emerald-400">Terminé</span>
                  </div>
                  <div className="p-2 bg-white/5 rounded text-xs text-neutral-300 border border-white/10 flex justify-between">
                    <span>QCM Automatismes #4</span>
                    <span className="text-amber-400">À faire</span>
                  </div>
                  <Button variant="outline" className="w-full mt-4 border-white/10 text-xs">
                    Assigner une ressource
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardPilotage>
      </div>
    </div>
  );
}
