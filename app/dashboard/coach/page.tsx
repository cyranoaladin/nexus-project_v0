"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Loader2, BookOpen, Users, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DashboardPilotage } from "@/components/dashboard/DashboardPilotage";
import CoachAvailability from "@/components/ui/coach-availability";
import { CohortTable } from "@/components/dashboard/coach/CohortTable";
import { PriorityAlerts } from "@/components/dashboard/coach/PriorityAlerts";

interface TodaySession {
  id: string;
  studentName: string;
  subject: string;
  time: string;
}

interface CoachDashboardData {
  coach: { pseudonym: string };
  students: any[];
  alerts: any[];
  uniqueStudentsCount: number;
  todaySessions: TodaySession[];
}

export default function DashboardCoach() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<CoachDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'availability'>('dashboard');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/coach/dashboard');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return
    if (!session || session.user.role !== 'COACH') {
      router.push("/auth/signin")
      return
    }
    fetchDashboardData()
  }, [session, status, router])

  if (loading) return <div className="min-h-screen bg-surface-darker flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-accent" /></div>

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <header className="bg-surface-card border-b border-white/10 h-16 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <BookOpen className="w-8 h-8 text-brand-accent" />
          <h1 className="font-bold text-white">Espace Coach — {dashboardData?.coach?.pseudonym ?? '...'}</h1>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-white/5 border-white/10">
            <TabsTrigger value="dashboard">Pilotage</TabsTrigger>
            <TabsTrigger value="availability">Agenda</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" onClick={() => signOut()}>Déconnexion</Button>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {activeTab === 'dashboard' && (
          <DashboardPilotage role="COACH">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 space-y-8">
                {/* Cohorte */}
                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-accent" />
                    Pilotage de Cohorte
                  </h2>
                  <CohortTable students={dashboardData?.students || []} />
                </div>

                {/* Planning */}
                <Card className="bg-surface-card border-white/10 shadow-premium">
                  <CardHeader>
                    <CardTitle className="text-white text-base">Planning du Jour</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(dashboardData?.todaySessions?.length ?? 0) > 0 ? (
                      <div className="space-y-4">
                        {dashboardData?.todaySessions.map((s) => (
                          <div key={s.id} className="p-4 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-bold text-white">{s.studentName}</p>
                              <p className="text-xs text-neutral-400">{s.subject} • {s.time}</p>
                            </div>
                            <Button size="sm">Rapport</Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-neutral-500 py-8 italic">Aucun cours aujourd'hui.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <PriorityAlerts alerts={dashboardData?.alerts || []} />
                
                <Card className="bg-gradient-to-br from-brand-accent/10 to-surface-card border border-brand-accent/20">
                  <CardContent className="p-6">
                    <Zap className="w-8 h-8 text-brand-accent mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Performance Coach</h3>
                    <p className="text-xs text-neutral-400 mb-4">
                      Vous avez accompagné {dashboardData?.uniqueStudentsCount ?? 0} élèves ce mois-ci.
                    </p>
                    <Button variant="outline" className="w-full border-white/10">Statistiques mensuelles</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </DashboardPilotage>
        )}

        {activeTab === 'availability' && (
          <CoachAvailability coachId={session?.user?.id ?? ''} onAvailabilityUpdated={fetchDashboardData} />
        )}
      </main>
    </div>
  )
}
