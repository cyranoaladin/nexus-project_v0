"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, TrendingUp, Calendar, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardPilotage } from "@/components/dashboard/DashboardPilotage";
import { ProgressEvolutionChart } from "@/components/dashboard/parent/ProgressEvolutionChart";
import { CohortComparison } from "@/components/dashboard/parent/CohortComparison";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function ChildDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;
  
  const [childData, setChildData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    const fetchChildData = async () => {
      try {
        const response = await fetch('/api/parent/dashboard');
        const data = await response.json();
        const child = data.children.find((c: any) => c.id === studentId);
        if (child) {
          setChildData(child);
        } else {
          router.push("/dashboard/parent");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchChildData();
    }
  }, [status, studentId, router]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (!childData) return null;

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/dashboard/parent">
          <Button variant="ghost" className="mb-6 text-neutral-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la famille
          </Button>
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              {childData.firstName} {childData.lastName}
            </h1>
            <p className="text-neutral-400">
              {childData.gradeLevel} • {childData.academicTrack.replace('_', ' ')}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-surface-card border border-white/10 p-4 rounded-xl text-center min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1">NexusIndex</p>
              <p className="text-2xl font-bold text-brand-accent">{childData.nexusIndex ?? '--'}</p>
            </div>
            <div className="bg-surface-card border border-white/10 p-4 rounded-xl text-center min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1">Position</p>
              <p className="text-2xl font-bold text-emerald-400">Top 15%</p>
            </div>
          </div>
        </div>

        <DashboardPilotage role="PARENT" studentId={studentId}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ProgressEvolutionChart data={childData.progressionHistory} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <CohortComparison 
                  studentName={childData.firstName}
                  data={[
                    { label: 'Analyse', value: 78, isStudent: true },
                    { label: 'Moyenne', value: 62, isStudent: false },
                    { label: 'Algèbre', value: 85, isStudent: true },
                    { label: 'Moyenne', value: 55, isStudent: false },
                  ]}
                />
                
                <Card className="bg-surface-card border border-white/10 shadow-premium">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-accent" />
                      Prochaines Étapes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-accent/20 flex items-center justify-center text-brand-accent text-xs font-bold">1</div>
                      <p className="text-sm text-neutral-300">Finaliser le module "Dérivation" (85% complété)</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-neutral-400 text-xs font-bold">2</div>
                      <p className="text-sm text-neutral-300">Participer à la session de groupe du 12 Mai</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-8">
              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-accent" />
                    Prochaines Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {childData.sessions.map((s: any) => (
                    <div key={s.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <p className="text-sm font-bold text-white">{s.subject}</p>
                      <p className="text-xs text-neutral-400">
                        {new Date(s.scheduledAt).toLocaleDateString('fr-FR')} • {s.coachName}
                      </p>
                    </div>
                  ))}
                  <Button className="w-full bg-brand-accent hover:bg-brand-accent/90">
                    Réserver une séance
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Abonnement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <p className="text-xs text-neutral-500 uppercase font-bold">Formule</p>
                    <p className="text-lg font-bold text-white">{childData.subscription}</p>
                  </div>
                  <Button variant="outline" className="w-full border-white/10">
                    Gérer l'abonnement
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
