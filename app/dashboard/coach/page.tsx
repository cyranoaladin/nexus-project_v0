"use client"

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Users, BookOpen, MessageCircle, User, LogOut, Loader2, Clock, CheckCircle, AlertCircle, Settings } from "lucide-react"
import { signOut } from "next-auth/react"
import CoachAvailability from "@/components/ui/coach-availability"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

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

  useEffect(() => {
    if (status === "loading") return

    if (!session || session.user.role !== 'COACH') {
      router.push("/auth/signin")
      return
    }

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

    fetchDashboardData()
  }, [session, status, router])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement de votre espace coach...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">Erreur lors du chargement</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    {dashboardData?.coach.pseudonym || session?.user.firstName}
                  </h1>
                  <p className="text-sm text-gray-500">Espace Coach</p>
                </div>
              </div>
              
              {/* Navigation Tabs */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg ml-8">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tableau de Bord
                </button>
                <button
                  onClick={() => setActiveTab('availability')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'availability'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Mes Disponibilités
                </button>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Bonjour {dashboardData?.coach.pseudonym} ! 👨‍🏫
              </h2>
              <p className="text-gray-600">
                Voici votre tableau de bord pour gérer vos sessions et suivre vos élèves.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {dashboardData?.coach.specialties?.map((specialty: string, index: number) => (
                  <Badge key={index} variant="outline">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Dialog open={isWeekDialogOpen} onOpenChange={setIsWeekDialogOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sessions Cette Semaine</CardTitle>
                  <Calendar className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData?.weekStats?.totalSessions || 0}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {dashboardData?.weekStats?.completedSessions || 0} terminées, {dashboardData?.weekStats?.upcomingSessions || 0} à venir
                  </p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Sessions de la semaine</DialogTitle>
              </DialogHeader>
              {dashboardData?.weekSessions && dashboardData.weekSessions.length > 0 ? (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  {dashboardData.weekSessions.map((s: any) => (
                    <div key={s.id} className="p-4 border rounded-lg flex flex-col md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{s.title || s.subject}</h4>
                          <Badge variant="outline" className="text-xs">{s.type}</Badge>
                          <Badge variant="default" className="text-xs">{s.modality}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Avec {s.studentName}</p>
                        <p className="text-sm text-blue-600 font-medium">{new Date(s.date).toLocaleDateString('fr-FR')} • {s.startTime} - {s.endTime} • {s.duration} min</p>
                        {s.description && (
                          <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                        )}
                      </div>
                      <div className="mt-3 md:mt-0 flex items-center gap-2">
                        <Badge className="text-xs">{s.status.toLowerCase()}</Badge>
                        <Badge variant="outline" className="text-xs">{s.creditsUsed} crédit(s)</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Aucune session planifiée cette semaine.</div>
              )}
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aujourd'hui</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {dashboardData?.todaySessions?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Sessions programmées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mes Élèves</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {dashboardData?.uniqueStudentsCount || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Élèves suivis ce mois
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Planning du Jour */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Planning d'Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.todaySessions && dashboardData.todaySessions.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.todaySessions.map((session: any) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{session.studentName}</h4>
                          <Badge variant="outline" className="text-xs">
                            {session.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{session.subject}</p>
                        <p className="text-sm font-medium text-blue-600">{session.time}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {session.status === 'scheduled' && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucune session aujourd'hui
                  </h3>
                  <p className="text-gray-500">
                    Profitez de cette journée pour préparer vos prochains cours.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mes Élèves */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-green-600" />
                Mes Élèves
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.students && dashboardData.students.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.students.map((student, index) => (
                    <div 
                      key={student.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        student.isNew 
                          ? 'bg-purple-50 border-purple-200' 
                          : index % 2 === 0 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{student.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {student.grade}
                          </Badge>
                          {student.isNew && (
                            <Badge variant="default" className="text-xs bg-purple-100 text-purple-800">
                              Nouveau
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {student.subject} • Dernière session: {new Date(student.lastSession).toLocaleDateString('fr-FR')}
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`text-xs font-medium ${
                            student.isNew 
                              ? 'text-purple-600' 
                              : index % 2 === 0 
                                ? 'text-green-600' 
                                : 'text-blue-600'
                          }`}>
                            {student.isNew ? 'Nouveau élève' : 'Progression: 75%'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {student.creditBalance.toFixed(1)} crédits restants
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          {student.isNew ? 'Planifier 1ère Session' : 'Voir Profil'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucun élève pour le moment
                  </h3>
                  <p className="text-gray-500">
                    Vos élèves apparaîtront ici une fois qu'ils auront réservé des sessions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

            {/* Actions Rapides */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex flex-col items-center space-y-2"
                    onClick={() => setActiveTab('availability')}
                  >
                    <Calendar className="w-6 h-6 text-blue-600" />
                    <span>Gérer mon Planning</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
                    <MessageCircle className="w-6 h-6 text-purple-600" />
                    <span>Messages Élèves</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
                    <BookOpen className="w-6 h-6 text-green-600" />
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
  )
}