"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// Select components reserved for future filter UI
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, CreditCard, TrendingUp, Users, LogOut, Loader2, AlertCircle } from "lucide-react"
import { signOut } from "next-auth/react"
import AddChildDialog from "./add-child-dialog"
import CreditPurchaseDialog from "./credit-purchase-dialog"
import SubscriptionChangeDialog from "./subscription-change-dialog"
import AriaAddonDialog from "./aria-addon-dialog"
import InvoiceDetailsDialog from "./invoice-details-dialog"
import SessionBooking from "@/components/ui/session-booking"
import { DashboardPilotage } from "@/components/dashboard/DashboardPilotage"
import { StudentSelector } from "@/components/dashboard/StudentSelector"
import { BilanGratuitBanner } from "@/components/dashboard/BilanGratuitBanner"

interface ParentDashboardData {
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  children: Array<{
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    grade: string;
    school: string;
    credits: number;
    subscription: string;
    subscriptionDetails: {
      planName: string;
      monthlyPrice: number;
      status: string;
      startDate: string;
      endDate: string;
    } | null;
    nextSession: {
      id: string;
      subject: string;
      scheduledAt: string;
      coachName: string;
      type: string;
      status: string;
    } | null;
    progress: number;
    subjectProgress: Record<string, number>;
    sessions: Array<{
      id: string;
      subject: string;
      scheduledAt: string;
      coachName: string;
      type: string;
      status: string;
      duration: number;
    }>;
  }>;
}

export default function DashboardParent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedChild, setSelectedChild] = useState<string>("")
  const [dashboardData, setDashboardData] = useState<ParentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard')
  const refreshDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/parent/dashboard')

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data = await response.json()
      setDashboardData(data)

      if (data.children.length > 0 && !selectedChild) {
        setSelectedChild(data.children[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [selectedChild])



  useEffect(() => {
    if (status === "loading") return

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin")
      return
    }

    refreshDashboardData()
  }, [session, status, router, refreshDashboardData])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" aria-label="Chargement" />
          <p className="text-neutral-400">Chargement de votre espace...</p>
        </div>
      </div>
    )
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

  const currentChild = dashboardData?.children.find((child) => child.id === selectedChild)

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100" data-testid="parent-dashboard-ready">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 sm:py-0 sm:h-16 gap-3 sm:gap-0">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-brand-accent flex-shrink-0" aria-hidden="true" />
                <div>
                  <h1 className="font-semibold text-white text-sm sm:text-base">
                    {session?.user.firstName} {session?.user.lastName}
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-400">Espace Parent</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'dashboard' | 'booking')} className="ml-4">
                <TabsList className="bg-white/5 border border-white/10">
                  <TabsTrigger value="dashboard" className="text-xs sm:text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    Tableau de Bord
                  </TabsTrigger>
                  <TabsTrigger value="booking" className="text-xs sm:text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    Réserver Session
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-neutral-300 hover:text-white text-xs sm:text-sm"
              aria-label="Se déconnecter"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Déconnexion</span>
              <span className="sm:hidden">Déco</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {activeTab === 'dashboard' && (
          <>
            {/* Bilan Gratuit Banner */}
            <BilanGratuitBanner />

            {/* Child Selector + Add Child */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <StudentSelector
                  selectedId={selectedChild}
                  onSelect={setSelectedChild}
                />
                <AddChildDialog onChildAdded={refreshDashboardData} />
              </div>
              {(dashboardData?.children.length ?? 0) > 1 && (
                <p className="text-[11px] text-neutral-500">Chaque trajectoire est pilotée individuellement.</p>
              )}
            </div>

            <DashboardPilotage role="PARENT" studentId={selectedChild}>
            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
              {/* Agenda de l'Enfant */}
              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-brand-accent" />
                    <span className="text-base sm:text-lg">Agenda de {currentChild?.firstName}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    {currentChild?.sessions && currentChild?.sessions.length > 0 ? (
                      currentChild?.sessions.map((session) => (
                        <div key={session.id} data-testid="session-card" className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-white text-sm sm:text-base">{session.subject}</p>
                            <p className="text-xs sm:text-sm text-neutral-300">
                              {new Date(session.scheduledAt).toLocaleDateString('fr-FR')} à {new Date(session.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-neutral-400">Coach: {session.coachName}</p>
                          </div>
                          <Badge variant={session.type === 'COURS_ONLINE' ? 'default' : 'outline'} className="text-xs border-white/10">
                            {session.type === 'COURS_ONLINE' ? 'En ligne' : 'Présentiel'}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 sm:py-8">
                        <p className="text-neutral-400 text-sm sm:text-base">Aucune session programmée</p>
                        <Button variant="outline" className="mt-2 text-xs sm:text-sm border-white/10 text-neutral-200 hover:text-white">
                          Réserver une Session
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Progression */}
              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-emerald-300" />
                    <span className="text-base sm:text-lg">Progression par Matière</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    {currentChild?.subjectProgress && Object.keys(currentChild?.subjectProgress).length > 0 ? (
                      Object.entries(currentChild?.subjectProgress).map(([subject, progress]) => (
                        <div key={subject}>
                          <div className="flex justify-between text-xs sm:text-sm mb-1">
                            <span className="text-neutral-300">{subject}</span>
                            <span className="text-neutral-300">{progress}%</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: progress > 80 ? '#10B981' : progress > 60 ? '#3B82F6' : progress > 40 ? '#F59E0B' : '#EF4444'
                              }}
                            ></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-neutral-400">Aucune progression disponible</p>
                        <p className="text-xs text-neutral-500 mt-1">Les données apparaîtront après les premières sessions</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section Abonnement et Facturation */}
            <Card className="mb-6 sm:mb-8 bg-surface-card border border-white/10 shadow-premium">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-emerald-300" />
                  <span className="text-base sm:text-lg">Abonnement et Facturation</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Abonnement Actuel */}
                  <div className="text-center p-3 sm:p-4 bg-white/5 border border-white/10 rounded-lg">
                    <h3 className="font-semibold text-white mb-2 text-sm sm:text-base">Formule Actuelle</h3>
                    <div className="text-xl sm:text-2xl font-bold text-brand-accent mb-1">
                      {currentChild?.subscriptionDetails?.planName || currentChild?.subscription}
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-400 mb-3">
                      {currentChild?.subscriptionDetails?.monthlyPrice || 0} TND/mois
                    </p>
                    <SubscriptionChangeDialog
                      studentId={currentChild?.id ?? ''}
                      studentName={`${currentChild?.firstName} ${currentChild?.lastName}`}
                      currentPlan={currentChild?.subscriptionDetails?.planName || currentChild?.subscription || 'Aucune formule'}
                      onRequestComplete={refreshDashboardData}
                    />
                  </div>

                  {/* Prochaine Facturation */}
                  <div className="text-center p-3 sm:p-4 bg-white/5 border border-white/10 rounded-lg">
                    <h3 className="font-semibold text-white mb-2 text-sm sm:text-base">Prochaine Facturation</h3>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-300 mb-1">
                      {currentChild?.subscriptionDetails?.endDate ?
                        new Date(currentChild?.subscriptionDetails.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) :
                        'N/A'
                      }
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-400 mb-3">
                      {currentChild?.subscriptionDetails?.monthlyPrice || 0} TND
                    </p>
                    <InvoiceDetailsDialog
                      subscriptionDetails={currentChild?.subscriptionDetails || null}
                      studentName={`${currentChild?.firstName} ${currentChild?.lastName}`}
                    />
                  </div>

                  {/* Actions */}
                  <div className="text-center p-3 sm:p-4 bg-white/5 border border-white/10 rounded-lg">
                    <h3 className="font-semibold text-white mb-2 text-sm sm:text-base">Actions</h3>
                    <div className="space-y-2">
                      <CreditPurchaseDialog
                        studentId={currentChild?.id ?? ''}
                        studentName={`${currentChild?.firstName ?? ''} ${currentChild?.lastName ?? ''}`}
                        onPurchaseComplete={refreshDashboardData}
                      />
                      <AriaAddonDialog
                        studentId={currentChild?.id ?? ''}
                        studentName={`${currentChild?.firstName} ${currentChild?.lastName}`}
                        onRequestComplete={refreshDashboardData}
                      />
                    </div>
                  </div>
                </div>

                {/* Note importante */}
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-xs sm:text-sm text-slate-200">
                    <strong>Note :</strong> Les demandes d'achat de crédits sont envoyées à l'assistant pour approbation.
                  </p>
                </div>
              </CardContent>
            </Card>
            </DashboardPilotage>
          </>
        )}

        {activeTab === 'booking' && currentChild && (
          <SessionBooking
            studentId={currentChild?.userId}
            parentId={session?.user?.id}
            userCredits={currentChild?.credits}
            onBookingComplete={(sessionId) => {
              refreshDashboardData();
              setActiveTab('dashboard');
            }}
          />
        )}
      </main>
    </div>
  )
}
