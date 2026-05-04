"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Loader2, BookOpen, Users, Zap, FileText } from "lucide-react";

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
  const [activeRubrique, setActiveRubrique] = useState<'cohorte' | 'planning' | 'alertes' | 'bilans'>('cohorte');

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
      <header className="bg-surface-card border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Row 1: user + logout */}
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-brand-accent shrink-0" />
              <h1 className="font-bold text-white text-sm sm:text-base truncate">
                Coach — {dashboardData?.coach?.pseudonym ?? '...'}
              </h1>
            </div>
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="h-8 sm:h-9 px-2 sm:px-3 text-neutral-300 hover:text-white">
              <FileText className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
          {/* Row 2: tabs */}
          <div className="pb-2 -mx-1 overflow-x-auto scrollbar-none">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="bg-white/5 border-white/10 w-full sm:w-auto">
                <TabsTrigger value="dashboard" className="flex-1 sm:flex-none text-xs sm:text-sm">Pilotage</TabsTrigger>
                <TabsTrigger value="availability" className="flex-1 sm:flex-none text-xs sm:text-sm">Agenda</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardPilotage role="COACH">
            <div className="space-y-6">
              {/* Rubriques Switcher */}
              <div className="mb-6 -mx-4 sm:mx-0">
                <div className="flex gap-1.5 sm:gap-2 p-1 bg-white/5 border-y sm:border border-white/10 sm:rounded-xl overflow-x-auto scrollbar-none px-4 sm:px-1">
                  {[
                    { id: 'cohorte', label: 'Cohorte' },
                    { id: 'planning', label: 'Planning' },
                    { id: 'alertes', label: 'Alertes' },
                    { id: 'bilans', label: 'Bilans' },
                  ].map((tab) => (
                    <Button
                      key={tab.id}
                      onClick={() => setActiveRubrique(tab.id as any)}
                      variant={activeRubrique === tab.id ? 'default' : 'ghost'}
                      className={`whitespace-nowrap rounded-lg transition-all text-xs sm:text-sm px-3 sm:px-4 shrink-0 sm:flex-1 ${
                        activeRubrique === tab.id
                          ? 'bg-brand-accent text-white shadow-premium font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                      size="sm"
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>

              {activeRubrique === 'cohorte' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-brand-accent" />
                        Pilotage de Cohorte
                      </h2>
                      <CohortTable students={dashboardData?.students || []} />
                    </div>
                    <div>
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
                </div>
              )}

              {activeRubrique === 'planning' && (
                <div className="space-y-6 animate-fadeIn">
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
              )}

              {activeRubrique === 'alertes' && (
                <div className="space-y-6 animate-fadeIn">
                  <PriorityAlerts alerts={dashboardData?.alerts || []} />
                </div>
              )}

              {activeRubrique === 'bilans' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-gradient-to-br from-brand-accent/10 to-surface-card border border-brand-accent/20">
                      <CardContent className="p-6">
                        <FileText className="w-8 h-8 text-brand-accent mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Bilan EAF – Stage de printemps</h3>
                        <p className="text-xs text-neutral-400 mb-4">
                          Renseignez les bilans pédagogiques des élèves de Première suivis pendant le stage.
                        </p>
                        <Button variant="outline" className="w-full border-white/10" onClick={() => router.push('/dashboard/coach/eaf-stage-printemps')}>
                          Gérer les bilans EAF
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-500/10 to-surface-card border border-indigo-500/20">
                      <CardContent className="p-6">
                        <Zap className="w-8 h-8 text-indigo-400 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Bilan Maths – Stage de printemps</h3>
                        <p className="text-xs text-neutral-400 mb-4">
                          Renseignez les bilans de spécialité mathématiques pour les élèves de Première.
                        </p>
                        <Button variant="outline" className="w-full border-white/10" onClick={() => router.push('/dashboard/coach/maths-premiere-stage-printemps')}>
                          Gérer les bilans Maths
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
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
