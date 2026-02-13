"use client";


import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Users, BookOpen, MessageCircle, LogOut, Loader2, Clock, CheckCircle, AlertCircle, FileText } from "lucide-react"
import { signOut } from "next-auth/react"
import CoachAvailability from "@/components/ui/coach-availability"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SessionReportDialog } from "@/components/ui/session-report-dialog"

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
  const [isWeekDialogOpen, setIsWeekDialogOpen] = useState(false)



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
      console.error('Error fetching dashboard data:', err)
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
    <div className="min-h-screen bg-surface-darker text-neutral-100">
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
          <>
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Bonjour {dashboardData?.coach.pseudonym} !
              </h2>
              <p className="text-neutral-300">
                Voici votre tableau de bord pour gérer vos sessions et suivre vos élèves.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {dashboardData?.coach.specialties?.map((specialty: string, index: number) => (
                  <Badge key={index} variant="outline" className="border-white/10 text-neutral-300">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Dialog open={isWeekDialogOpen} onOpenChange={setIsWeekDialogOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer bg-surface-card border border-white/10 shadow-premium">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Sessions Cette Semaine</CardTitle>
                  <Calendar className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-brand-accent">
                    {dashboardData?.weekStats?.totalSessions || 0}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    {dashboardData?.weekStats?.completedSessions || 0} terminées, {dashboardData?.weekStats?.upcomingSessions || 0} à venir
                  </p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-3xl bg-surface-card border border-white/10 text-neutral-100">
              <DialogHeader>
                <DialogTitle className="text-white">Sessions de la semaine</DialogTitle>
              </DialogHeader>
              {dashboardData?.weekSessions && dashboardData.weekSessions.length > 0 ? (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  {dashboardData.weekSessions.map((s) => (
                    <div key={s.id} className="p-4 border border-white/10 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between bg-white/5">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-white">{s.title || s.subject}</h4>
                          <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">{s.type}</Badge>
                          <Badge variant="default" className="text-xs">{s.modality}</Badge>
                        </div>
                        <p className="text-sm text-neutral-300 mt-1">Avec {s.studentName}</p>
                        <p className="text-sm text-brand-accent font-medium">{new Date(s.date).toLocaleDateString('fr-FR')} • {s.startTime} - {s.endTime} • {s.duration} min</p>
                        {s.description && (
                          <p className="text-xs text-neutral-400 mt-1">{s.description}</p>
                        )}
                      </div>
                      <div className="mt-3 md:mt-0 flex items-center gap-2">
                        <Badge className="text-xs">{s.status.toLowerCase()}</Badge>
                        <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">{s.creditsUsed} crédit(s)</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-neutral-400 text-sm">Aucune session planifiée cette semaine.</div>
              )}
            </DialogContent>
          </Dialog>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Aujourd'hui</CardTitle>
              <Clock className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {dashboardData?.todaySessions?.length || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Sessions programmées
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Mes Élèves</CardTitle>
              <Users className="h-4 w-4 text-purple-300" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {dashboardData?.uniqueStudentsCount || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Élèves suivis ce mois
              </p>
            </CardContent>
          </Card>
        </div>

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
                            <Badge variant="default" className="text-xs bg-purple-500/15 text-purple-200 border border-purple-500/20">
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
            <Card className="mt-8 bg-surface-card border border-white/10 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white">Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white"
                    onClick={() => setActiveTab('availability')}
                  >
                    <Calendar className="w-6 h-6 text-brand-accent" aria-hidden="true" />
                    <span>Gérer mon Planning</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white">
                    <MessageCircle className="w-6 h-6 text-purple-300" aria-hidden="true" />
                    <span>Messages Élèves</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white">
                    <BookOpen className="w-6 h-6 text-emerald-300" aria-hidden="true" />
                    <span>Rédiger un Rapport</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'availability' && session?.user?.id && (
          <CoachAvailability 
            coachId={session.user.id}
            onAvailabilityUpdated={() => {
              // Optionally refresh dashboard data
              console.log('Availability updated');
            }}
          />
        )}
      </main>
    </div>
  );
}
