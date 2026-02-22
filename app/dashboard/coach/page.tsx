"use client";


import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Users, BookOpen, MessageCircle, LogOut, Loader2, CheckCircle, AlertCircle, FileText } from "lucide-react"
import { signOut } from "next-auth/react"
import CoachAvailability from "@/components/ui/coach-availability"
// Dialog components reserved for weekly schedule feature
import { SessionReportDialog } from "@/components/ui/session-report-dialog"
import { DashboardPilotage } from "@/components/dashboard/DashboardPilotage"

interface CoachDashboardData {
  coach: {
    id: string;
    pseudonym: string;
    tag: string;
    firstName: string;
    lastName: string;
    email: string;
    specialties: string[];
  };
  todaySessions: Array<{
    id: string;
    studentName: string;
    subject: string;
    time: string;
    type: string;
    status: string;
    scheduledAt: string;
    duration: number;
  }>;
  weekStats: {
    totalSessions: number;
    completedSessions: number;
    upcomingSessions: number;
  };
  students: Array<{
    id: string;
    name: string;
    grade: string;
    subject: string;
    lastSession: string;
    creditBalance: number;
    isNew: boolean;
  }>;
  uniqueStudentsCount: number;
  weekSessions: Array<{
    id: string;
    title: string;
    subject: string;
    type: string;
    modality: string;
    studentName: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    description: string;
    status: string;
    creditsUsed: number;
  }>;
}

export default function DashboardCoach() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<CoachDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'availability'>('dashboard')
  const [_isWeekDialogOpen, _setIsWeekDialogOpen] = useState(false)



  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/coach/dashboard')
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }
      
      const data = await response.json()
      setDashboardData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const refreshDashboard = () => {
    fetchDashboardData()
  }

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'COACH') {
      router.push("/auth/signin");
      return;
    }

    fetchDashboardData()
  }, [session, status, router])


  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" aria-label="Chargement" />
          <p className="text-neutral-400">Chargement de votre espace coach...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" aria-label="Erreur" />
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            className="btn-primary mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100" data-testid="coach-dashboard-ready">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-8 h-8 text-brand-accent" aria-hidden="true" />
                <div>
                  <h1 className="font-semibold text-white">
                    {dashboardData?.coach.pseudonym || session?.user.firstName}
                  </h1>
                  <p className="text-sm text-neutral-400">Espace Coach</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'dashboard' | 'availability')} className="ml-8">
                <TabsList className="bg-white/5 border border-white/10">
                  <TabsTrigger value="dashboard" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    Tableau de Bord
                  </TabsTrigger>
                  <TabsTrigger value="availability" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    Mes Disponibilités
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-neutral-300 hover:text-white"
              aria-label="Se déconnecter"
            >
              <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardPilotage role="COACH">
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Planning du Jour */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-brand-accent" aria-hidden="true" />
                Planning d'Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.todaySessions && dashboardData.todaySessions.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.todaySessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-white">{session.studentName}</h4>
                          <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">
                            {session.type}
                          </Badge>
                          {session.status === 'COMPLETED' && (
                            <Badge variant="default" className="text-xs bg-emerald-500/15 text-emerald-200 border border-emerald-500/20">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Rapport soumis
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-neutral-300">{session.subject}</p>
                        <p className="text-sm font-medium text-brand-accent">{session.time}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {(session.status === 'CONFIRMED' || session.status === 'IN_PROGRESS') && (
                          <SessionReportDialog
                            sessionId={session.id}
                            onReportSubmitted={refreshDashboard}
                            trigger={
                              <Button size="sm">
                                <FileText className="w-4 h-4 mr-2" />
                                Soumettre rapport
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-neutral-500 mx-auto mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    Aucune session aujourd'hui
                  </h3>
                  <p className="text-neutral-400">
                    Profitez de cette journée pour préparer vos prochains cours.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mes Élèves */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-emerald-300" aria-hidden="true" />
                Mes Élèves
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.students && dashboardData.students.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.students.map((student, index) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-white">{student.name}</h4>
                          <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">
                            {student.grade}
                          </Badge>
                          {student.isNew && (
                            <Badge variant="default" className="text-xs bg-blue-500/15 text-blue-200 border border-blue-500/20">
                              Nouveau
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-neutral-300">
                          {student.subject} • Dernière session: {new Date(student.lastSession).toLocaleDateString('fr-FR')}
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs font-medium text-neutral-200">
                            {student.isNew ? 'Nouveau élève' : 'Progression: 75%'}
                          </span>
                          <span className="text-xs text-neutral-400">
                            {student.creditBalance.toFixed(1)} crédits restants
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" className="border-white/10 text-neutral-200 hover:text-white">
                          {student.isNew ? 'Planifier 1ère Session' : 'Voir Profil'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-neutral-500 mx-auto mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    Aucun élève pour le moment
                  </h3>
                  <p className="text-neutral-400">
                    Vos élèves apparaîtront ici une fois qu'ils auront réservé des sessions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

            {/* Actions Rapides */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white"
                onClick={() => setActiveTab('availability')}
              >
                <Calendar className="w-5 h-5 text-brand-accent" aria-hidden="true" />
                <span className="text-xs">Gérer mon planning</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white">
                <MessageCircle className="w-5 h-5 text-blue-300" aria-hidden="true" />
                <span className="text-xs">Messages élèves</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white">
                <BookOpen className="w-5 h-5 text-emerald-300" aria-hidden="true" />
                <span className="text-xs">Rédiger un rapport</span>
              </Button>
            </div>
          </DashboardPilotage>
        )}

        {activeTab === 'availability' && session?.user?.id && (
          <CoachAvailability 
            coachId={session.user.id}
            onAvailabilityUpdated={() => {
              // Optionally refresh dashboard data
            }}
          />
        )}
      </main>
    </div>
  );
}
